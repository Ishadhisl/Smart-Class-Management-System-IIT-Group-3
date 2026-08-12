import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { request } from '../../services/api';

const LandingPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  const getImageUrl = (url) => {
    if (!url) return '';
    const normalizedUrl = url.replace(/\\/g, '/');
    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      return normalizedUrl;
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const path = normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`;
    return `${baseUrl}${path}`;
  };
  const [formData, setFormData] = useState({
    student_name: '',
    school: '',
    grade: '',
    parent_name: '',
    parent_phone: '',
    email: '',
    course_id: ''
  });

  // පිටුවේ දෙපස පවතින කළු පැහැති ඉඩ (Pillarboxing) ඉවත් කිරීම සඳහා
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.style.maxWidth = 'none';
      root.style.padding = '0';
      root.style.margin = '0';
      root.style.width = '100%';
      root.style.textAlign = 'left';
    }
  }, []);

  // පන්ති ලැයිස්තුව ලබා ගැනීම
  useEffect(() => {
    request('/courses/public')
      .then(data => setCourses(data || []))
      .catch(err => console.error("Error fetching courses:", err));
  }, []);

  const handlePreRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await request('/students/register-public', { // Use request helper for public route
        method: 'POST',
        body: formData // request helper will stringify if not FormData
      });
      // request helper throws error if !response.ok, so no need to check response.ok here
      if (response) { // Check if response is not null/undefined
        alert('ලියාපදිංචිය සාර්ථකයි! කරුණාකර අනුමැතිය සඳහා කාර්යාලයට පැමිණෙන්න.');
        setIsModalOpen(false);
        setFormData({ student_name: '', school: '', grade: '', parent_phone: '', email: '', course_id: '' });
      } else {
        const data = await response.json();
        alert(data.error || 'ලියාපදිංචිය අසාර්ථකයි.');
      }
    } catch (err) {
      console.error('Pre-registration error:', err);
      alert('පද්ධති දෝෂයකි. පසුව උත්සාහ කරන්න.');
    }
  };

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    subject: '',
    message_text: ''
  });
  const [contactStatus, setContactStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactStatus('loading');
    setContactError('');
    try {
      await request('/contact/submit', { body: contactForm });
      setContactStatus('success');
      setContactForm({ sender_name: '', sender_email: '', sender_phone: '', subject: '', message_text: '' });
    } catch (err) {
      setContactStatus('error');
      setContactError(err.message || 'පණිවිඩය යැවීමට නොහැකි විය. නැවත උත්සාහ කරන්න.');
    }
  };

  // Hover states for buttons/links
  const [isLoginHovered, setIsLoginHovered] = useState(false);
  const [isExploreHovered, setIsExploreHovered] = useState(false);
  const [isRegisterHovered, setIsRegisterHovered] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [promoLoading, setPromoLoading] = useState(true);

  // ගුරු මඩුල්ලේ විස්තර (Mock data - පසුව Backend එකෙන් ලබාගත හැක)
  const [currentLecturer, setCurrentLecturer] = useState(0);
  const [lecturersList, setLecturersList] = useState([
    {
      name: "තුසිත ගුරුතුමා",
      subject: "භෞතික විද්‍යාව (Physics)",
      description: "වසර 15කට අධික අත්දැකීම් සහිත ප්‍රමුඛතම දේශක.",
      image: "/Project%20LOGO.png"
    },
    {
      name: "අමිල ගුරුතුමා",
      subject: "රසායන විද්‍යාව (Chemistry)",
      description: "සරලව හා නිරවුල්ව විෂය කරුණු කියාදෙන දක්ෂ ගුරුවරයෙක්.",
      image: "/Project%20LOGO.png"
    },
    {
      name: "නිමල් ගුරුතුමා",
      subject: "සංයුක්ත ගණිතය (Applied Math)",
      description: "විෂය නිර්දේශය ඉක්මවා යන තාර්කික දැනුමක් ලබා දෙන දේශක.",
      image: "/Project%20LOGO.png"
    }
  ]);

  const nextLecturer = () => setCurrentLecturer((prev) => (prev + 1) % lecturersList.length);
  const prevLecturer = () => setCurrentLecturer((prev) => (prev - 1 + lecturersList.length) % lecturersList.length);

  // Promotions, Announcements, Achievements සහ ගුරුවරුන් Backend එකෙන් ලබා ගැනීම
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [promoData, annData, achData, teacherData] = await Promise.all([
           request('/promos').catch(() => []),
           request('/announcements/public').catch(() => []),
           request('/achievements/public').catch(() => []),
           request('/teachers/public').catch(() => [])
        ]);
        setPromotions(promoData || []);
        // Only show active announcements on public page
        setAnnouncements((annData || []).filter(a => a.is_active));
        setAchievements(achData || []);
        if (teacherData && teacherData.length > 0) {
          const mapped = teacherData.map(t => ({
            name: t.lecturer_name,
            subject: t.specialization,
            description: t.bio || t.qualifications || "අධ්‍යාපන ක්ෂේත්‍රයේ ප්‍රවීණ දේශකයෙක්.",
            image: t.profile_photo_path ? getImageUrl(t.profile_photo_path) : "/Project%20LOGO.png"
          }));
          setLecturersList(mapped);
        }
      } catch (err) { 
        console.error("Error fetching data:", err); 
      } finally { 
        setPromoLoading(false); 
      }
    };
    fetchData();
  }, []);

  // Define Color Palette
  const PRIMARY_NAVY = '#070D59';
  const SECONDARY_BLUE = '#1F3C88';
  const LIGHT_ACCENT_BLUE = '#5893D4';
  const BACKGROUND_BLUE = '#CEDDEF';
  const GREEN_SUCCESS = '#2e7d32'; // Keeping green for registration as per previous discussion
  const GREEN_SUCCESS_HOVER = '#1b5e20';

  // SonarQube S3358: Extract nested ternary into independent statement
  let promoContent;
  if (promoLoading) {
    promoContent = <p style={{ color: SECONDARY_BLUE }}>ප්‍රවර්ධන දත්ත පූරණය වෙමින් පවතී...</p>;
  } else if (promotions.length > 0) {
    promoContent = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '30px', justifyContent: 'center' }}> {/* SonarQube: S3358 handled by extracting promoContent */}
        {promotions.map((promo) => (
          <button key={promo.promo_id} type="button" onClick={() => setPreviewImage(getImageUrl(promo.image_url))} style={{ // Changed to button for accessibility and interactivity
            border: 'none', // Remove default button border
            cursor: 'pointer', // Indicate interactivity
            width: '100%', // Ensure it takes full width of grid cell
            textAlign: 'left', // Align content to left
            backgroundColor: 'white', 
            borderRadius: '15px', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)', 
            overflow: 'hidden', 
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            padding: 0
          }}>
            {promo.image_url && (
              <div style={{ position: 'relative', overflow: 'hidden', height: '240px', width: '100%' }}>
                <img 
                  src={getImageUrl(promo.image_url)} 
                  alt={promo.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} 
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                />
                <div style={{ position: 'absolute', bottom: '12px', right: '12px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 'bold' }}>
                  🔍 Click to Zoom
                </div>
              </div>
            )}
            <div style={{ padding: '20px' }}>
              <span style={{ fontSize: '12px', color: LIGHT_ACCENT_BLUE, fontWeight: 'bold', textTransform: 'uppercase' }}>{promo.content_type}</span>
              <h4 style={{ color: PRIMARY_NAVY, margin: '10px 0', fontSize: '18px' }}>{promo.title}</h4>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>{promo.description}</p>
            </div>
          </button>
        ))}
      </div>
    );
  } else {
    promoContent = <p style={{ color: SECONDARY_BLUE }}>දැනට ප්‍රවර්ධන දත්ත නොමැත.</p>;
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Sinhala', 'Segoe UI', Tahoma, sans-serif", color: '#333', backgroundColor: '#ffffff', minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
      {/* Navigation Bar */}
      <nav style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '15px 5%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottom: `1px solid ${BACKGROUND_BLUE}`,
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000, 
        flexWrap: 'wrap', 
        gap: '15px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/Project%20LOGO.png" alt="Thusitha Logo" style={{ width: '45px', height: 'auto' }} />
          <h2 style={{ margin: 0, color: PRIMARY_NAVY, fontWeight: '800', fontSize: 'clamp(18px, 4vw, 26px)' }}>Thusitha Smart Academy</h2>
        </div>
        <div style={{ display: 'flex', gap: 'clamp(15px, 3vw, 30px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/courses" style={{ textDecoration: 'none', color: SECONDARY_BLUE, fontWeight: '600', fontSize: '14px', transition: 'color 0.3s ease' }} onMouseEnter={e => e.target.style.color=LIGHT_ACCENT_BLUE} onMouseLeave={e => e.target.style.color=SECONDARY_BLUE}>පන්ති</a>
          <a href="/teachers" style={{ textDecoration: 'none', color: SECONDARY_BLUE, fontWeight: '600', fontSize: '14px', transition: 'color 0.3s ease' }} onMouseEnter={e => e.target.style.color=LIGHT_ACCENT_BLUE} onMouseLeave={e => e.target.style.color=SECONDARY_BLUE}>ගුරු මඩුල්ල</a>
          <a href="#contact" style={{ textDecoration: 'none', color: SECONDARY_BLUE, fontWeight: '600', fontSize: '14px', transition: 'color 0.3s ease' }} onMouseEnter={e => e.target.style.color=LIGHT_ACCENT_BLUE} onMouseLeave={e => e.target.style.color=SECONDARY_BLUE}>සම්බන්ධ වන්න</a>
          <button
            onClick={() => navigate('/login')}
            onMouseEnter={() => setIsLoginHovered(true)}
            onMouseLeave={() => setIsLoginHovered(false)}
            style={{
              padding: '10px 25px',
              backgroundColor: isLoginHovered ? SECONDARY_BLUE : PRIMARY_NAVY,
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ 
        padding: '80px 5%', 
        background: `linear-gradient(135deg, ${BACKGROUND_BLUE} 0%, #ffffff 100%)`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        minHeight: '80vh',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '320px', paddingRight: '40px' }}>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)', color: PRIMARY_NAVY, marginBottom: '24px', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-1px' }}>
            හෙට දවස දිනන <br/><span style={{color: LIGHT_ACCENT_BLUE}}>දක්ෂයෙකු</span> වන්න.
          </h1>
          <p style={{ fontSize: '20px', color: '#555', marginBottom: '40px', lineHeight: '1.6' }}>නවීන තාක්ෂණය සමඟ අධ්‍යාපනයේ නව අත්දැකීමක්. Thusitha Smart Academy සමඟින් ඔබේ අධ්‍යාපන සිහින සැබෑ කරගන්න. දැන්ම අප සමඟ එක්වී ඔබේ අනාගතය ජයගන්න.</p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsModalOpen(true)}
              onMouseEnter={() => setIsRegisterHovered(true)}
              onMouseLeave={() => setIsRegisterHovered(false)}
              style={{
                padding: '18px 40px',
                backgroundColor: isRegisterHovered ? GREEN_SUCCESS_HOVER : GREEN_SUCCESS,
                color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer',
                boxShadow: isRegisterHovered ? '0 15px 30px rgba(46, 125, 50, 0.3)' : '0 10px 20px rgba(46, 125, 50, 0.2)', // Increased shadow on hover
                transform: isRegisterHovered ? 'translateY(-2px)' : 'translateY(0)', // Slight lift on hover
                transition: 'all 0.3s ease'
              }}
            >දැන්ම ලියාපදිංචි වන්න</button>
            <a
              href="/courses"
              onMouseEnter={() => setIsExploreHovered(true)}
              onMouseLeave={() => setIsExploreHovered(false)}
              style={{
                padding: '16px 38px',
                backgroundColor: isExploreHovered ? BACKGROUND_BLUE : 'white',
                color: SECONDARY_BLUE, textDecoration: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '18px',
                border: `2px solid ${SECONDARY_BLUE}`, transition: 'all 0.3s ease'
              }}
            >පන්ති ගවේෂණය</a>
          </div>
        </div>
        <div style={{ flex: '1', minWidth: '320px', display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <div style={{ 
            width: '100%', maxWidth: '450px', minHeight: '380px', backgroundColor: 'white', borderRadius: '30px', 
            boxShadow: '0 30px 60px rgba(7, 13, 89, 0.15)', overflow: 'hidden', border: `8px solid ${PRIMARY_NAVY}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative',
            padding: '20px', textAlign: 'center', transition: 'all 0.5s ease'
          }}>
            <h4 style={{ color: PRIMARY_NAVY, margin: '0 0 15px 0', fontSize: '18px' }}>අපගේ ගුරු මඩුල්ල</h4>
            
            <div style={{ 
              width: '120px', height: '120px', borderRadius: '50%', backgroundColor: BACKGROUND_BLUE, 
              marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `4px solid ${LIGHT_ACCENT_BLUE}`, overflow: 'hidden'
            }}>
              <img src={lecturersList[currentLecturer].image} alt="Guru" style={{ width: lecturersList[currentLecturer].image.includes('Project%20LOGO.png') ? '80%' : '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
            </div>

            <h3 style={{ margin: '0', color: SECONDARY_BLUE, fontSize: '22px' }}>{lecturersList[currentLecturer].name}</h3>
            <p style={{ margin: '5px 0', color: LIGHT_ACCENT_BLUE, fontWeight: 'bold', fontSize: '14px' }}>{lecturersList[currentLecturer].subject}</p>
            <p style={{ margin: '10px 0', color: '#666', fontSize: '13px', lineHeight: '1.4' }}>{lecturersList[currentLecturer].description}</p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={prevLecturer}
                style={{ 
                  padding: '8px 20px', backgroundColor: PRIMARY_NAVY, color: 'white', 
                  border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                }}
              >
                ⬅ පෙර
              </button>
              <button 
                onClick={nextLecturer}
                style={{ 
                  padding: '8px 20px', backgroundColor: PRIMARY_NAVY, color: 'white', 
                  border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                }}
              >
                මීළඟ ➔
              </button>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginTop: '15px' }}>
              {lecturersList.map((lecturer, i) => (
                <button 
                  key={lecturer.name}
                  type="button"
                  aria-label={`Go to lecturer ${lecturer.name}`}
                  style={{ width: '8px', height: '8px', borderRadius: '50%', padding: 0, border: 'none', backgroundColor: currentLecturer === i ? PRIMARY_NAVY : BACKGROUND_BLUE, cursor: 'pointer' }}
                  onClick={() => setCurrentLecturer(i)}
                ></button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <section style={{ padding: '40px 5%', backgroundColor: '#fff3cd', borderBottom: '2px solid #ffeeba', textAlign: 'center' }}>
          <h3 style={{ color: '#856404', fontSize: '24px', marginBottom: '15px' }}>📢 විශේෂ නිවේදන</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px', margin: '0 auto' }}>
            {announcements.map(a => (
              <div key={a.announcement_id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', borderLeft: '5px solid #ffc107', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#856404' }}>{a.title}</h4>
                <p style={{ margin: 0, color: '#666', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{a.body}</p>
                <small style={{ color: '#999', display: 'block', marginTop: '5px' }}>{new Date(a.posted_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Promotions Section (Flyers, Teacher Profiles, Achievements) */}
      <section id="promotions" style={{ padding: '80px 5%', backgroundColor: BACKGROUND_BLUE, textAlign: 'center' }}>
        <h2 style={{ color: PRIMARY_NAVY, fontSize: '36px', marginBottom: '20px', fontWeight: '700' }}>අපගේ නවතම ප්‍රවර්ධන සහ විශේෂාංග</h2>
        <p style={{ color: '#666', marginBottom: '60px' }}>අපගේ සිසුන්ගේ සාර්ථකත්වයන්, දේශකයන්ගේ විස්තර සහ නවතම පන්ති පිළිබඳ තොරතුරු.</p>
        
        {promoContent}

        {achievements.length > 0 && (
          <div style={{ marginTop: '60px' }}>
            <h3 style={{ color: PRIMARY_NAVY, fontSize: '28px', marginBottom: '30px' }}>🏆 අපගේ විශිෂ්ටයින්</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', justifyContent: 'center' }}>
              {achievements.map(ach => (
                <div key={ach.achievement_id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', textAlign: 'center', borderTop: '4px solid #ffc107' }}>
                  {ach.photo_path ? (
                    <img 
                      src={getImageUrl(ach.photo_path)} 
                      alt={ach.title} 
                      style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffc107', display: 'block', margin: '0 auto 10px' }}
                    />
                  ) : (
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🥇</div>
                  )}
                  <h4 style={{ color: PRIMARY_NAVY, margin: '0 0 10px 0', fontSize: '18px' }}>{ach.student_name}</h4>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontWeight: 'bold' }}>{ach.title}</p>
                  {ach.island_rank && <p style={{ margin: '0 0 5px 0', color: '#d32f2f', fontWeight: 'bold' }}>Island Rank: {ach.island_rank}</p>}
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>{ach.achieved_year}</p>
                  {ach.description && <p style={{ margin: '10px 0 0 0', color: '#666', fontSize: '13px' }}>{ach.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Smart Features Showcase */}
      <section id="features" style={{ padding: '100px 5%', textAlign: 'center', backgroundColor: '#ffffff' }}>
        <h2 style={{ color: PRIMARY_NAVY, fontSize: '36px', marginBottom: '20px', fontWeight: '700' }}>පද්ධති විශේෂාංග</h2>
        <p style={{ color: '#666', marginBottom: '60px' }}>අධ්‍යාපනය සහ තාක්ෂණය එකට එක්වූ අපගේ විශේෂත්වයන්</p>
        <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: '📱', title: 'Smart QR Attendance', desc: 'ආරක්ෂිත සහ වේගවත් QR පැමිණීමේ පද්ධතිය සමඟ සිසුන්ගේ පැමිණීම නිරීක්ෂණය කරන්න.' },
            { icon: '🧠', title: 'AI-Powered Monitoring', desc: 'AI තාක්ෂණය භාවිතයෙන් පන්ති කාමර ක්‍රියාකාරකම් වඩාත් නිවැරදිව අධීක්ෂණය කරන්න.' },
            { icon: '💻', title: 'Digital Learning Experience', desc: 'ඕනෑම තැනක සිට ඉගෙනුම් ද්‍රව්‍ය සහ පාඩම් වෙත ප්‍රවේශ වන්න.' },
            { icon: '💳', title: 'Easy Fee Management', desc: 'ගෙවීම් සහ මූල්‍ය තොරතුරු එකම ස්ථානයකින් කළමනාකරණය කරන්න.' }
          ].map((f, index) => (
            <button key={f.title} 
              type="button"
              style={{ flex: '1', minWidth: '250px', padding: '40px 30px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease', border: `1px solid ${BACKGROUND_BLUE}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 15px 50px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = PRIMARY_NAVY;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = BACKGROUND_BLUE;
              }}>
              <div style={{ fontSize: '50px', marginBottom: '20px', color: LIGHT_ACCENT_BLUE }}>{f.icon}</div>
              <h4 style={{ color: PRIMARY_NAVY, marginBottom: '15px', fontSize: '20px', fontWeight: '700' }}>{f.title}</h4>
              <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.6' }}>{f.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" style={{
        padding: '100px 5%',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 50%, #f5f7ff 100%)',
        borderTop: `4px solid ${BACKGROUND_BLUE}`
      }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ color: PRIMARY_NAVY, fontSize: '36px', fontWeight: '800', marginBottom: '15px', letterSpacing: '-0.5px' }}>
            📬 අප හා සම්බන්ධ වන්න
          </h2>
          <p style={{ color: '#666', fontSize: '17px', maxWidth: '600px', margin: '0 auto', lineHeight: '1.7' }}>
            ඔබට ඕනෑම ප්‍රශ්නයක් හෝ විමසීමක් ඇත්නම් අප වෙත සෘජුවම පණිවිඩයක් යවන්න. ඉක්මනින් ප්‍රතිචාර දක්වන්නෙමු.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '50px',
          flexWrap: 'wrap',
          maxWidth: '1100px',
          margin: '0 auto',
          alignItems: 'flex-start'
        }}>
          {/* Left: Contact Info */}
          <div style={{ flex: '1', minWidth: '280px' }}>
            <div style={{
              backgroundColor: PRIMARY_NAVY,
              borderRadius: '20px',
              padding: '40px',
              color: 'white',
              boxShadow: '0 20px 60px rgba(7, 13, 89, 0.2)',
              position: 'sticky',
              top: '100px'
            }}>
              <h3 style={{ color: LIGHT_ACCENT_BLUE, fontSize: '22px', marginBottom: '30px', fontWeight: '700' }}>📞 සම්බන්ධ විස්තර</h3>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '25px' }}>
                <div style={{ fontSize: '24px', marginTop: '2px' }}>📍</div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: '700', color: LIGHT_ACCENT_BLUE, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ලිපිනය</p>
                  <p style={{ margin: 0, opacity: 0.9, lineHeight: '1.6', fontSize: '15px' }}>Thusitha Education Center,<br/>Gampaha, Sri Lanka</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '25px' }}>
                <div style={{ fontSize: '24px', marginTop: '2px' }}>📞</div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: '700', color: LIGHT_ACCENT_BLUE, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>දුරකථනය</p>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: '15px' }}>033-2238380</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '35px' }}>
                <div style={{ fontSize: '24px', marginTop: '2px' }}>✉️</div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: '700', color: LIGHT_ACCENT_BLUE, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ඊමේල්</p>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: '15px' }}>info@thusitha.edu</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '25px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: LIGHT_ACCENT_BLUE, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⏰ කාර්යාල වේලාව</p>
                <p style={{ margin: '0 0 4px 0', opacity: 0.9, fontSize: '14px' }}>සඳුදා — සිකුරාදා: 8am – 6pm</p>
                <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>සෙනසුරාදා: 8am – 2pm</p>
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div style={{ flex: '1.4', minWidth: '300px' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '45px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.06)',
              border: `1px solid ${BACKGROUND_BLUE}`
            }}>
              <h3 style={{ color: PRIMARY_NAVY, fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>✍️ පණිවිඩයක් යවන්න</h3>
              <p style={{ color: '#888', fontSize: '14px', marginBottom: '30px' }}>සියලු ක්ෂේත්‍ර (*) සහිත ඒවා පිරවීම අනිවාර්ය වේ.</p>

              {/* Success Message */}
              {contactStatus === 'success' && (
                <div style={{
                  backgroundColor: '#e8f5e9',
                  border: '1px solid #4caf50',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  marginBottom: '25px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  <div>
                    <p style={{ margin: '0 0 3px 0', fontWeight: '700', color: '#2e7d32', fontSize: '15px' }}>ඔබේ පණිවිඩය ලැබුණි!</p>
                    <p style={{ margin: 0, color: '#388e3c', fontSize: '13px' }}>ඉක්මනින් ඔබ වෙත ප්‍රතිචාර දක්වන්නෙමු. ස්තූතියි! 🙏</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {contactStatus === 'error' && (
                <div style={{
                  backgroundColor: '#ffebee',
                  border: '1px solid #ef5350',
                  borderRadius: '10px',
                  padding: '15px 20px',
                  marginBottom: '25px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '20px' }}>❌</span>
                  <p style={{ margin: 0, color: '#c62828', fontSize: '14px' }}>{contactError}</p>
                </div>
              )}

              {contactStatus !== 'success' && (
                <form onSubmit={handleContactSubmit}>
                  {/* Row 1: Name & Email */}
                  <div style={{ display: 'flex', gap: '15px', marginBottom: '18px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <label htmlFor="contact_sender_name" style={{ display: 'block', marginBottom: '7px', fontWeight: '600', fontSize: '14px', color: '#444' }}>
                        ඔබේ නම *
                      </label>
                      <input
                        id="contact_sender_name"
                        type="text"
                        placeholder="නම ඇතුළත් කරන්න"
                        required
                        value={contactForm.sender_name}
                        onChange={e => setContactForm({ ...contactForm, sender_name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 15px',
                          borderRadius: '10px',
                          border: `1.5px solid ${BACKGROUND_BLUE}`,
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.target.style.borderColor = LIGHT_ACCENT_BLUE}
                        onBlur={e => e.target.style.borderColor = BACKGROUND_BLUE}
                      />
                    </div>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <label htmlFor="contact_sender_email" style={{ display: 'block', marginBottom: '7px', fontWeight: '600', fontSize: '14px', color: '#444' }}>
                        ඊමේල් ලිපිනය *
                      </label>
                      <input
                        id="contact_sender_email"
                        type="email"
                        placeholder="email@example.com"
                        required
                        value={contactForm.sender_email}
                        onChange={e => setContactForm({ ...contactForm, sender_email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 15px',
                          borderRadius: '10px',
                          border: `1.5px solid ${BACKGROUND_BLUE}`,
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.target.style.borderColor = LIGHT_ACCENT_BLUE}
                        onBlur={e => e.target.style.borderColor = BACKGROUND_BLUE}
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone & Subject */}
                  <div style={{ display: 'flex', gap: '15px', marginBottom: '18px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <label htmlFor="contact_sender_phone" style={{ display: 'block', marginBottom: '7px', fontWeight: '600', fontSize: '14px', color: '#444' }}>
                        දුරකථන අංකය
                      </label>
                      <input
                        id="contact_sender_phone"
                        type="tel"
                        placeholder="07X-XXXXXXX"
                        value={contactForm.sender_phone}
                        onChange={e => setContactForm({ ...contactForm, sender_phone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 15px',
                          borderRadius: '10px',
                          border: `1.5px solid ${BACKGROUND_BLUE}`,
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.target.style.borderColor = LIGHT_ACCENT_BLUE}
                        onBlur={e => e.target.style.borderColor = BACKGROUND_BLUE}
                      />
                    </div>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <label htmlFor="contact_subject" style={{ display: 'block', marginBottom: '7px', fontWeight: '600', fontSize: '14px', color: '#444' }}>
                        විෂය/මාතෘකාව
                      </label>
                      <input
                        id="contact_subject"
                        type="text"
                        placeholder="eg: ගාස්තු විමසීම"
                        value={contactForm.subject}
                        onChange={e => setContactForm({ ...contactForm, subject: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 15px',
                          borderRadius: '10px',
                          border: `1.5px solid ${BACKGROUND_BLUE}`,
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s ease',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.target.style.borderColor = LIGHT_ACCENT_BLUE}
                        onBlur={e => e.target.style.borderColor = BACKGROUND_BLUE}
                      />
                    </div>
                  </div>

                  {/* Row 3: Message */}
                  <div style={{ marginBottom: '25px' }}>
                    <label htmlFor="contact_message" style={{ display: 'block', marginBottom: '7px', fontWeight: '600', fontSize: '14px', color: '#444' }}>
                      ඔබේ පණිවිඩය *
                    </label>
                    <textarea
                      id="contact_message"
                      required
                      rows={5}
                      placeholder="ඔබේ ප්‍රශ්නය හෝ විමසීම මෙහි ලියන්න..."
                      value={contactForm.message_text}
                      onChange={e => setContactForm({ ...contactForm, message_text: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 15px',
                        borderRadius: '10px',
                        border: `1.5px solid ${BACKGROUND_BLUE}`,
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        lineHeight: '1.6',
                        transition: 'border-color 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={e => e.target.style.borderColor = LIGHT_ACCENT_BLUE}
                      onBlur={e => e.target.style.borderColor = BACKGROUND_BLUE}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={contactStatus === 'loading'}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: contactStatus === 'loading'
                        ? '#9e9e9e'
                        : `linear-gradient(135deg, ${PRIMARY_NAVY} 0%, ${SECONDARY_BLUE} 100%)`,
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: contactStatus === 'loading' ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '16px',
                      letterSpacing: '0.3px',
                      boxShadow: contactStatus === 'loading' ? 'none' : '0 8px 25px rgba(7,13,89,0.3)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    {contactStatus === 'loading' ? (
                      <><span>⏳</span> යවමින් පවතී...</>
                    ) : (
                      <><span>🚀</span> පණිවිඩය යවන්න</>
                    )}
                  </button>
                </form>
              )}

              {/* Reset button after success */}
              {contactStatus === 'success' && (
                <button
                  onClick={() => setContactStatus('idle')}
                  style={{
                    marginTop: '15px',
                    width: '100%',
                    padding: '13px',
                    backgroundColor: 'transparent',
                    color: SECONDARY_BLUE,
                    border: `2px solid ${SECONDARY_BLUE}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🔄 තවත් පණිවිඩයක් යවන්න
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: PRIMARY_NAVY, color: 'white', padding: '60px 5% 20px', borderTop: `5px solid ${LIGHT_ACCENT_BLUE}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px', marginBottom: '40px' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <img src="/Project%20LOGO.png" alt="Logo" style={{ width: '50px', backgroundColor: 'white', borderRadius: '50%', padding: '5px' }} />
              <h3 style={{ margin: 0, fontSize: '24px', color: LIGHT_ACCENT_BLUE }}>Thusitha Smart Academy</h3>
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.8', opacity: 0.8 }}>දිවයිනේ ප්‍රමුඛතම අධ්‍යාපන ආයතනයක් ලෙස නවීන තාක්ෂණය සමඟින් දරුවන්ගේ අනාගතය සුබදායී කිරීමට අපි කැපවී සිටින්නෙමු.</p>
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <h4 style={{ color: LIGHT_ACCENT_BLUE, marginBottom: '20px' }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', padding: 0, lineHeight: '2.2' }}>
              <li style={{ marginBottom: '10px' }}><a href="#home" style={{ color: '#aab', textDecoration: 'none' }}>මුල් පිටුව</a></li>
              <li style={{ marginBottom: '10px' }}><a href="/courses" style={{ color: '#aab', textDecoration: 'none' }}>පන්ති</a></li>
              <li style={{ marginBottom: '10px' }}><a href="/teachers" style={{ color: '#aab', textDecoration: 'none' }}>ගුරු මඩුල්ල</a></li>
            </ul>
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <h4 style={{ color: LIGHT_ACCENT_BLUE, marginBottom: '20px' }}>සම්බන්ධ වන්න</h4>
            <p style={{ fontSize: '14px', marginBottom: '10px' }}>📍 Thusitha Education Center, Gampaha</p>
            <p style={{ fontSize: '14px', marginBottom: '10px' }}>📞 033-2238380</p>
            <p style={{ fontSize: '14px' }}>✉️ info@thusitha.edu</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', fontSize: '12px', opacity: 0.6 }}>
          &copy; {new Date().getFullYear()} Thusitha Smart Academy. All Rights Reserved.
        </div>
      </footer>

      {/* Registration Modal Popup */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', maxWidth: '500px', width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'none', fontSize: '28px', cursor: 'pointer', color: '#666' }}>&times;</button>
            <h2 style={{ color: '#1a237e', marginBottom: '10px', textAlign: 'center' }}>ලියාපදිංචි වන්න</h2>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px', fontSize: '14px' }}>ඔබේ තොරතුරු ඇතුළත් කර පන්තියට අදාළ අසුනක් වෙන් කරවා ගන්න.</p>
            
            <form onSubmit={handlePreRegister}>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="student_name" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ශිෂ්‍යයාගේ නම</label>
                <input id="student_name" type="text" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.student_name} onChange={e => setFormData({...formData, student_name: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="school" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>පාසල</label>
                  <input id="school" type="text" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="grade" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ශ්‍රේණිය</label>
                  <input id="grade" type="text" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="parent_name" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>මව්පිය / භාරකාර නම</label>
                <input id="parent_name" type="text" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.parent_name} onChange={e => setFormData({...formData, parent_name: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="parent_phone" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>දෙමාපිය දුරකථන අංකය</label>
                <input id="parent_phone" type="tel" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="course_id" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>උනන්දුවක් දක්වන පන්තිය (Interested Course)</label>
                <select id="course_id" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.course_id} onChange={e => setFormData({...formData, course_id: e.target.value})} required>
                  <option value="">-- පන්තියක් තෝරන්න --</option>
                  {courses.map(c => (
                    <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label htmlFor="email" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ඊමේල් ලිපිනය (ඇත්නම්)</label>
                <input id="email" type="email" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              
              <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: PRIMARY_NAVY, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                ලියාපදිංචි කිරීම තහවුරු කරන්න
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && ReactDOM.createPortal(
        <div 
          onClick={() => setPreviewImage(null)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 10000,
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)} 
              style={{ 
                position: 'absolute', 
                top: '-45px', 
                right: '0', 
                background: 'rgba(255,255,255,0.2)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '50%', 
                width: '36px', 
                height: '36px', 
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.4)'}
              onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
              ✕
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '85vh', 
                borderRadius: '12px', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                border: '3px solid rgba(255,255,255,0.1)'
              }} 
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LandingPage;