import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Phone, Mail, Clock, Send, CheckCircle2, XCircle, RotateCcw,
  ChevronLeft, ChevronRight, ZoomIn, X, Menu, Trophy, Medal, Megaphone,
  QrCode, BrainCircuit, Laptop, CreditCard, Bell, Sparkles, Star, Award,
} from 'lucide-react';
import { request, API_URL } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Label from '../../components/common/Label';
import Select from '../../components/common/Select';
import Textarea from '../../components/common/Textarea';
import Modal from '../../components/common/Modal';
import Avatar from '../../components/common/Avatar';
import FormError from '../../components/common/FormError';
import { filterNameInput, filterPhoneInput, validateName, validateEmail, validatePhone, validateRequired } from '../../utils/formValidation';

const FEATURES = [
  { icon: QrCode, title: 'Smart QR Attendance', desc: 'ආරක්ෂිත සහ වේගවත් QR පැමිණීමේ පද්ධතිය සමඟ සිසුන්ගේ පැමිණීම නිරීක්ෂණය කරන්න.' },
  { icon: BrainCircuit, title: 'AI-Powered Monitoring', desc: 'AI තාක්ෂණය භාවිතයෙන් පන්ති කාමර ක්‍රියාකාරකම් වඩාත් නිවැරදිව අධීක්ෂණය කරන්න.' },
  { icon: Laptop, title: 'Digital Learning Experience', desc: 'ඕනෑම තැනක සිට ඉගෙනුම් ද්‍රව්‍ය සහ පාඩම් වෙත ප්‍රවේශ වන්න.' },
  { icon: CreditCard, title: 'Easy Fee Management', desc: 'ගෙවීම් සහ මූල්‍ය තොරතුරු එකම ස්ථානයකින් කළමනාකරණය කරන්න.' },
];

const NAV_LINKS = [
  { href: '/courses', label: 'පන්ති' },
  { href: '/teachers', label: 'ගුරු මඩුල්ල' },
  { href: '#contact', label: 'සම්බන්ධ වන්න' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getImageUrl = (url) => {
    if (!url) return '';
    const normalizedUrl = url.replace(/\\/g, '/');
    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      return normalizedUrl;
    }
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
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
        showNotification('ලියාපදිංචිය සාර්ථකයි! කරුණාකර අනුමැතිය සඳහා කාර්යාලයට පැමිණෙන්න.');
        setIsModalOpen(false);
        setFormData({ student_name: '', school: '', grade: '', parent_phone: '', email: '', course_id: '' });
      } else {
        const data = await response.json();
        showNotification(data.error || 'ලියාපදිංචිය අසාර්ථකයි.', 'error');
      }
    } catch (err) {
      console.error('Pre-registration error:', err);
      showNotification('පද්ධති දෝෂයකි. පසුව උත්සාහ කරන්න.', 'error');
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
  const [contactFieldErrors, setContactFieldErrors] = useState({});

  const validateContactForm = () => {
    const errors = {
      sender_name: validateName(contactForm.sender_name, { label: 'නම' }),
      sender_email: validateEmail(contactForm.sender_email),
      sender_phone: validatePhone(contactForm.sender_phone, { required: false }),
      message_text: validateRequired(contactForm.message_text, 'පණිවිඩය'),
    };
    setContactFieldErrors(errors);
    return Object.values(errors).every((msg) => !msg);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!validateContactForm()) return;
    setContactStatus('loading');
    setContactError('');
    try {
      await request('/contact/submit', { body: contactForm });
      setContactStatus('success');
      setContactForm({ sender_name: '', sender_email: '', sender_phone: '', subject: '', message_text: '' });
      setContactFieldErrors({});
    } catch (err) {
      setContactStatus('error');
      setContactError(err.message || 'පණිවිඩය යැවීමට නොහැකි විය. නැවත උත්සාහ කරන්න.');
    }
  };

  const [promotions, setPromotions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [brokenPromoIds, setBrokenPromoIds] = useState([]);

  // ගුරු මඩුල්ලේ විස්තර (Mock data - පසුව Backend එකෙන් ලබාගත හැක)
  const [currentLecturer, setCurrentLecturer] = useState(0);
  const [lecturersList, setLecturersList] = useState([
    {
      name: "තුසිත ගුරුතුමා",
      subject: "භෞතික විද්‍යාව (Physics)",
      description: "වසර 15කට අධික අත්දැකීම් සහිත ප්‍රමුඛතම දේශක.",
      image: "/teachers/thusitha.png"
    },
    {
      name: "අමිල ගුරුතුමා",
      subject: "රසායන විද්‍යාව (Chemistry)",
      description: "සරලව හා නිරවුල්ව විෂය කරුණු කියාදෙන දක්ෂ ගුරුවරයෙක්.",
      image: "/teachers/amila.png"
    },
    {
      name: "නිමල් ගුරුතුමා",
      subject: "සංයුක්ත ගණිතය (Applied Math)",
      description: "විෂය නිර්දේශය ඉක්මවා යන තාර්කික දැනුමක් ලබා දෙන දේශක.",
      image: "/teachers/nimal.png"
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
          // Map teacher names to custom portraits
          const teacherPhotoMap = {
            'ruwan': '/teachers/ruwan.png',
            'nimali': '/teachers/nimali.png',
            'sunil': '/teachers/sunil.png',
            'sumeera': '/teachers/sumeera.png',
            'sampath': '/teachers/sampath.png',
            'namal': '/teachers/namal.png',
            'shanika': '/teachers/shanika.png',
            'thusitha': '/teachers/thusitha.png'
          };
          
          const getTeacherPhoto = (name, dbPath) => {
            // A real uploaded photo always wins - the name-keyed map below is only a
            // fallback for demo/seed teachers with no photo of their own. Without this
            // priority, a substring match (e.g. "Sandaruwan" containing "ruwan") could
            // silently swap in a *different* teacher's placeholder portrait.
            if (dbPath) return getImageUrl(dbPath);
            const nameLower = name?.toLowerCase() || '';
            for (const [key, path] of Object.entries(teacherPhotoMap)) {
              if (nameLower.includes(key)) return path;
            }
            return "/Project%20LOGO.png";
          };

          // Deduplicate by name
          const uniqueTeachers = Array.from(new Map(teacherData.map(t => [t.lecturer_name, t])).values());

          const mapped = uniqueTeachers.map(t => ({
            name: t.lecturer_name,
            subject: t.specialization,
            description: t.bio || t.qualifications || "අධ්‍යාපන ක්ෂේත්‍රයේ ප්‍රවීණ දේශකයෙක්.",
            image: getTeacherPhoto(t.lecturer_name, t.profile_photo_path)
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

  const currentTeacher = lecturersList[currentLecturer];
  const isTeacherPlaceholder = currentTeacher.image.includes('Project%20LOGO.png');

  // Map student names to their photos for achievements
  const achieverPhotoMap = {
    'Peshala Bandara': '/achievers/peshala.jpg',
    'peshala bandara': '/achievers/peshala.jpg',
    'Kavindu Rathnayake': '/achievers/kavindu.png',
    'kavindu rathnayake': '/achievers/kavindu.png',
  };

  const getAchieverPhoto = (ach) => {
    if (ach.image_url) return getImageUrl(ach.image_url);
    // Try matching by name
    const nameKey = ach.student_name?.toLowerCase();
    for (const [key, path] of Object.entries(achieverPhotoMap)) {
      if (nameKey && nameKey.includes(key.toLowerCase())) return path;
    }
    return null;
  };

  // Promotions come purely from the database (Admin → ප්‍රවර්ධන tab). Only skip rows
  // with no usable image. A card whose image later 404s hides itself via onError below.
  const allPromotions = promotions.filter(p => {
    const u = (p.image_url || '').trim();
    if (u === '' || u === 'null' || u === 'undefined') return false;
    return !brokenPromoIds.includes(p.promo_id);
  });

  return (
    <div className="text-slate-700 bg-white min-h-screen w-full overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] bg-white/85 backdrop-blur-md border-b border-indigo-100">
        <div className="flex items-center justify-between px-[5%] py-3">
          <div className="flex items-center gap-2.5">
            <img src="/Project%20LOGO.png" alt="Thusitha Logo" className="w-11 h-auto" />
            <h2 className="m-0 text-primary-dark font-extrabold text-[clamp(18px,4vw,26px)]">Thusitha Smart Academy</h2>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-[clamp(15px,3vw,30px)]">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-primary font-semibold text-sm hover:text-primary-light transition-colors">
                {link.label}
              </a>
            ))}
            <Button variant="primary" size="sm" className="!rounded-full" onClick={() => navigate('/login')}>
              Login
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2 text-primary-dark"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-indigo-100 bg-white"
            >
              <div className="flex flex-col p-5 gap-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-primary font-semibold text-sm"
                  >
                    {link.label}
                  </a>
                ))}
                <Button variant="primary" fullWidth onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}>
                  Login
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <header className="pt-32 pb-20 px-[5%] bg-gradient-to-br from-indigo-50 to-white flex items-center justify-between flex-wrap min-h-[80vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 min-w-[320px] pr-0 md:pr-10"
        >
          <h1 className="text-[clamp(36px,5vw,60px)] text-primary-dark mb-6 leading-[1.1] font-extrabold tracking-tight">
            හෙට දවස දිනන <br /><span className="text-primary-light">දක්ෂයෙකු</span> වන්න.
          </h1>
          <p className="text-xl text-slate-500 mb-10 leading-relaxed">
            නවීන තාක්ෂණය සමඟ අධ්‍යාපනයේ නව අත්දැකීමක්. Thusitha Smart Academy සමඟින් ඔබේ අධ්‍යාපන සිහින සැබෑ කරගන්න. දැන්ම අප සමඟ එක්වී ඔබේ අනාගතය ජයගන්න.
          </p>
          <div className="flex gap-5 flex-wrap">
            <Button variant="success" size="lg" className="!rounded-full" onClick={() => setIsModalOpen(true)}>
              දැන්ම ලියාපදිංචි වන්න
            </Button>
            <Button as="a" href="/courses" variant="outline" size="lg" className="!rounded-full !border-2 !border-primary !text-primary">
              පන්ති ගවේෂණය
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex-1 min-w-[320px] flex justify-center mt-10"
        >
          <Card padding="p-6" hover className="w-full max-w-[450px] min-h-[380px] text-center flex flex-col items-center justify-center !rounded-[30px] !border-2 !border-primary-dark/20">
            <h4 className="text-primary-dark m-0 mb-4 text-lg font-bold">අපගේ ගුරු මඩුල්ල</h4>

            <div className="w-[120px] h-[120px] rounded-full bg-indigo-50 mb-4 flex items-center justify-center border-4 border-primary-light overflow-hidden">
              <img
                src={currentTeacher.image}
                alt={currentTeacher.name}
                loading="lazy"
                className={`${isTeacherPlaceholder ? 'w-4/5' : 'w-full'} h-full object-cover opacity-90`}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentLecturer}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="m-0 text-primary text-xl font-bold">{currentTeacher.name}</h3>
                <p className="my-1 text-primary-light font-bold text-sm">{currentTeacher.subject}</p>
                <p className="my-2 text-slate-500 text-[13px] leading-snug">{currentTeacher.description}</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-2.5 mt-5">
              <Button variant="primary" size="sm" className="!rounded-full !px-4" icon={<ChevronLeft size={14} />} onClick={prevLecturer}>
                පෙර
              </Button>
              <Button variant="primary" size="sm" className="!rounded-full !px-4" onClick={nextLecturer}>
                මීළඟ <ChevronRight size={14} />
              </Button>
            </div>

            <div className="flex gap-1.5 mt-4">
              {lecturersList.map((lecturer, i) => (
                <button
                  key={`lecturer-dot-${i}`}
                  type="button"
                  aria-label={`Go to lecturer ${lecturer.name}`}
                  className={`w-2 h-2 rounded-full p-0 border-none cursor-pointer transition-colors ${currentLecturer === i ? 'bg-primary-dark' : 'bg-indigo-100'}`}
                  onClick={() => setCurrentLecturer(i)}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      </header>

      {/* Announcements Section — Enhanced */}
      {announcements.length > 0 && (
        <section className="relative py-16 px-[5%] overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" />
          <div className="absolute top-0 left-0 w-72 h-72 bg-warning-light/20 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl -mr-20 -mb-20 pointer-events-none" />
          
          <div className="relative z-10 text-center">
            {/* Animated Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10"
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Bell size={16} />
                </motion.div>
                නිවේදන / Announcements
              </div>
              <h3 className="text-3xl font-extrabold bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700 bg-clip-text text-transparent flex items-center justify-center gap-3">
                <motion.div animate={{ rotate: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Megaphone size={28} className="text-amber-500" />
                </motion.div>
                විශේෂ නිවේදන
                <Sparkles size={22} className="text-amber-400" />
              </h3>
            </motion.div>

            {/* Announcement Cards */}
            <div className="flex flex-col gap-5 max-w-3xl mx-auto">
              {announcements.map((a, index) => (
                <motion.div
                  key={a.announcement_id}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10" />
                  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 text-left border border-amber-100/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                    {/* Decorative accent bar */}
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 via-orange-500 to-amber-400 rounded-l-2xl" />
                    <div className="pl-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white p-2.5 rounded-xl shadow-md">
                            <Megaphone size={18} />
                          </div>
                          <div>
                            <h4 className="m-0 text-lg font-bold text-gray-800">{a.title}</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock size={12} className="text-amber-500" />
                              <span className="text-xs font-medium text-amber-600">{new Date(a.posted_at).toLocaleDateString('si-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>
                        <motion.div
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ repeat: Infinity, duration: 2, delay: index * 0.3 }}
                          className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                        >
                          New
                        </motion.div>
                      </div>
                      <p className="m-0 mt-3 text-slate-600 text-[15px] leading-relaxed whitespace-pre-wrap">{a.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promotions Section (Flyers, Teacher Profiles, Achievements) */}
      <section id="promotions" className="py-20 px-[5%] bg-indigo-50 text-center">
        <h2 className="text-primary-dark text-4xl font-bold mb-5">අපගේ නවතම ප්‍රවර්ධන සහ විශේෂාංග</h2>
        <p className="text-slate-500 mb-14">අපගේ සිසුන්ගේ සාර්ථකත්වයන්, දේශකයන්ගේ විස්තර සහ නවතම පන්ති පිළිබඳ තොරතුරු.</p>

        {promoLoading && <p className="text-primary">ප්‍රවර්ධන දත්ත පූරණය වෙමින් පවතී...</p>}
        {!promoLoading && (
          <div className="grid gap-7 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))' }}>
            {allPromotions.map((promo) => {
              // Always route through getImageUrl: a stored "/uploads/x.png" is a path on the
              // BACKEND, not this Vercel origin — the old startsWith('/') shortcut sent it to
              // the wrong host and every card 404'd.
              const imgSrc = getImageUrl(promo.image_url);
              return (
                <motion.button
                  key={promo.promo_id}
                  type="button"
                  whileHover={{ y: -4 }}
                  onClick={() => setPreviewImage(imgSrc)}
                  className="text-left bg-white rounded-2xl shadow-glass hover:shadow-glass-hover overflow-hidden transition-shadow p-0 border-none cursor-pointer"
                >
                  {promo.image_url && (
                    <div className="relative overflow-hidden h-60 w-full group">
                      <img
                        src={imgSrc}
                        alt={promo.title}
                        loading="lazy"
                        onError={() => setBrokenPromoIds((ids) => ids.includes(promo.promo_id) ? ids : [...ids, promo.promo_id])}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105 bg-indigo-50"
                      />
                      <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 font-bold">
                        <ZoomIn size={12} /> Click to Zoom
                      </div>
                    </div>
                  )}
                  <div className="p-5">
                    <span className="text-xs text-primary-light font-bold uppercase">{promo.content_type}</span>
                    <h4 className="text-primary-dark my-2.5 text-lg font-bold">{promo.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{promo.description}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Achievements Section — Enhanced with Photos */}
        {achievements.length > 0 && (
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-100/50 to-transparent rounded-3xl -z-10" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10"
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-5 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
                <Award size={16} /> Top Achievers
              </div>
              <h3 className="text-primary-dark text-3xl font-extrabold flex items-center justify-center gap-3">
                <Trophy size={28} className="text-amber-500" /> අපගේ විශිෂ්ටයින්
                <Star size={22} className="text-amber-400" />
              </h3>
            </motion.div>
            <div className="grid gap-6 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {achievements.map((ach, index) => {
                const photoSrc = getAchieverPhoto(ach);
                return (
                  <motion.div
                    key={ach.achievement_id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    whileHover={{ y: -6 }}
                  >
                    <div className="relative bg-white rounded-3xl p-6 text-center border-2 border-amber-200/50 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                      {/* Top decorative gradient */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400" />
                      {/* Trophy watermark */}
                      <div className="absolute top-3 right-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Trophy size={60} className="text-amber-400" />
                      </div>

                      {/* Photo */}
                      {photoSrc ? (
                        <div className="relative mx-auto mb-4 w-24 h-24">
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full animate-spin" style={{ animationDuration: '8s' }} />
                          <img
                            src={photoSrc}
                            alt={ach.student_name}
                            loading="lazy"
                            className="relative w-[88px] h-[88px] rounded-full object-cover border-3 border-white block mx-auto mt-[4px] ml-[4px] shadow-md"
                          />
                        </div>
                      ) : (
                        <div className="mx-auto mb-4 w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                          <Medal size={40} className="text-amber-500" />
                        </div>
                      )}

                      <h4 className="text-primary-dark m-0 mb-1 text-xl font-extrabold">{ach.student_name}</h4>
                      <p className="m-0 mb-2 text-primary-light font-bold text-sm">{ach.title}</p>
                      {ach.island_rank && (
                        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md mb-2">
                          <Star size={14} /> Island Rank: {ach.island_rank}
                        </div>
                      )}
                      <p className="m-0 text-slate-400 text-xs font-medium">{ach.achieved_year}</p>
                      {ach.description && <p className="mt-3 mb-0 text-slate-500 text-[13px] leading-relaxed">{ach.description}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Smart Features Showcase */}
      <section id="features" className="py-24 px-[5%] text-center bg-white">
        <h2 className="text-primary-dark text-4xl font-bold mb-5">පද්ධති විශේෂාංග</h2>
        <p className="text-slate-500 mb-14">අධ්‍යාපනය සහ තාක්ෂණය එකට එක්වූ අපගේ විශේෂත්වයන්</p>
        <div className="flex gap-7 justify-center flex-wrap">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} hover padding="p-9" className="flex-1 min-w-[250px] text-left !rounded-[20px]">
                <div className="mb-5 text-primary-light"><Icon size={44} /></div>
                <h4 className="text-primary-dark mb-3 text-xl font-bold">{f.title}</h4>
                <p className="text-slate-500 text-[15px] leading-relaxed">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-24 px-[5%] bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50 border-t-4 border-indigo-100">
        <div className="text-center mb-14">
          <h2 className="text-primary-dark text-4xl font-extrabold mb-4 flex items-center justify-center gap-2">
            <Mail size={30} /> අප හා සම්බන්ධ වන්න
          </h2>
          <p className="text-slate-500 text-[17px] max-w-xl mx-auto leading-relaxed">
            ඔබට ඕනෑම ප්‍රශ්නයක් හෝ විමසීමක් ඇත්නම් අප වෙත සෘජුවම පණිවිඩයක් යවන්න. ඉක්මනින් ප්‍රතිචාර දක්වන්නෙමු.
          </p>
        </div>

        <div className="flex gap-12 flex-wrap max-w-5xl mx-auto items-start">
          {/* Left: Contact Info */}
          <div className="flex-1 min-w-[280px]">
            <div className="bg-gradient-to-br from-primary-dark to-primary rounded-2xl p-10 text-white shadow-glass-hover sticky top-24">
              <h3 className="text-indigo-100 text-xl mb-7 font-bold flex items-center gap-2">
                <Phone size={20} /> සම්බන්ධ විස්තර
              </h3>

              <div className="flex items-start gap-4 mb-6">
                <MapPin size={22} className="mt-0.5 shrink-0 text-indigo-200" />
                <div>
                  <p className="m-0 mb-1 font-bold text-indigo-200 text-xs uppercase tracking-wide">ලිපිනය</p>
                  <p className="m-0 opacity-90 leading-relaxed text-[15px]">Thusitha Education Center,<br />Gampaha, Sri Lanka</p>
                </div>
              </div>

              <div className="flex items-start gap-4 mb-6">
                <Phone size={22} className="mt-0.5 shrink-0 text-indigo-200" />
                <div>
                  <p className="m-0 mb-1 font-bold text-indigo-200 text-xs uppercase tracking-wide">දුරකථනය</p>
                  <p className="m-0 opacity-90 text-[15px]">033-2238380</p>
                </div>
              </div>

              <div className="flex items-start gap-4 mb-8">
                <Mail size={22} className="mt-0.5 shrink-0 text-indigo-200" />
                <div>
                  <p className="m-0 mb-1 font-bold text-indigo-200 text-xs uppercase tracking-wide">ඊමේල්</p>
                  <p className="m-0 opacity-90 text-[15px]">info@thusitha.edu</p>
                </div>
              </div>

              <div className="border-t border-white/15 pt-6">
                <p className="m-0 mb-2 font-bold text-indigo-200 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Clock size={14} /> කාර්යාල වේලාව
                </p>
                <p className="m-0 mb-1 opacity-90 text-sm">සඳුදා — සිකුරාදා: 8am – 6pm</p>
                <p className="m-0 opacity-90 text-sm">සෙනසුරාදා: 8am – 2pm</p>
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="flex-[1.4] min-w-[300px]">
            <Card padding="p-9 sm:p-11" hover={false}>
              <h3 className="text-primary-dark text-2xl font-bold mb-2">පණිවිඩයක් යවන්න</h3>
              <p className="text-slate-400 text-sm mb-7">සියලු ක්ෂේත්‍ර (*) සහිත ඒවා පිරවීම අනිවාර්ය වේ.</p>

              {contactStatus === 'success' && (
                <div className="bg-success-light/15 border border-success-light rounded-xl p-4 mb-6 flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-success shrink-0" />
                  <div>
                    <p className="m-0 mb-0.5 font-bold text-success-dark text-[15px]">ඔබේ පණිවිඩය ලැබුණි!</p>
                    <p className="m-0 text-success text-[13px]">ඉක්මනින් ඔබ වෙත ප්‍රතිචාර දක්වන්නෙමු. ස්තූතියි! 🙏</p>
                  </div>
                </div>
              )}

              {contactStatus === 'error' && (
                <div className="bg-danger-light/15 border border-danger-light rounded-xl p-4 mb-6 flex items-center gap-3">
                  <XCircle size={20} className="text-danger shrink-0" />
                  <p className="m-0 text-danger-dark text-sm">{contactError}</p>
                </div>
              )}

              {contactStatus !== 'success' && (
                <form onSubmit={handleContactSubmit}>
                  <div className="flex gap-4 mb-5 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="contact_sender_name">ඔබේ නම *</Label>
                      <Input
                        id="contact_sender_name" type="text" placeholder="නම ඇතුළත් කරන්න" required maxLength={100}
                        invalid={!!contactFieldErrors.sender_name}
                        value={contactForm.sender_name}
                        onChange={e => {
                          const v = filterNameInput(e.target.value);
                          setContactForm({ ...contactForm, sender_name: v });
                          if (contactFieldErrors.sender_name) setContactFieldErrors({ ...contactFieldErrors, sender_name: validateName(v, { label: 'නම' }) });
                        }}
                        onBlur={e => setContactFieldErrors({ ...contactFieldErrors, sender_name: validateName(e.target.value, { label: 'නම' }) })}
                      />
                      <FormError>{contactFieldErrors.sender_name}</FormError>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="contact_sender_email">ඊමේල් ලිපිනය *</Label>
                      <Input
                        id="contact_sender_email" type="email" placeholder="email@example.com" required maxLength={150}
                        invalid={!!contactFieldErrors.sender_email}
                        value={contactForm.sender_email}
                        onChange={e => {
                          setContactForm({ ...contactForm, sender_email: e.target.value });
                          if (contactFieldErrors.sender_email) setContactFieldErrors({ ...contactFieldErrors, sender_email: validateEmail(e.target.value) });
                        }}
                        onBlur={e => setContactFieldErrors({ ...contactFieldErrors, sender_email: validateEmail(e.target.value) })}
                      />
                      <FormError>{contactFieldErrors.sender_email}</FormError>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-5 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="contact_sender_phone">දුරකථන අංකය</Label>
                      <Input
                        id="contact_sender_phone" type="tel" placeholder="07XXXXXXXX" maxLength={13}
                        invalid={!!contactFieldErrors.sender_phone}
                        value={contactForm.sender_phone}
                        onChange={e => {
                          const v = filterPhoneInput(e.target.value);
                          setContactForm({ ...contactForm, sender_phone: v });
                          if (contactFieldErrors.sender_phone) setContactFieldErrors({ ...contactFieldErrors, sender_phone: validatePhone(v, { required: false }) });
                        }}
                        onBlur={e => setContactFieldErrors({ ...contactFieldErrors, sender_phone: validatePhone(e.target.value, { required: false }) })}
                      />
                      <FormError>{contactFieldErrors.sender_phone}</FormError>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="contact_subject">විෂය/මාතෘකාව</Label>
                      <Input
                        id="contact_subject" type="text" placeholder="eg: ගාස්තු විමසීම" maxLength={150}
                        value={contactForm.subject}
                        onChange={e => setContactForm({ ...contactForm, subject: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="contact_message">ඔබේ පණිවිඩය *</Label>
                    <Textarea
                      id="contact_message" required rows={5} maxLength={2000} placeholder="ඔබේ ප්‍රශ්නය හෝ විමසීම මෙහි ලියන්න..."
                      invalid={!!contactFieldErrors.message_text}
                      value={contactForm.message_text}
                      onChange={e => {
                        setContactForm({ ...contactForm, message_text: e.target.value });
                        if (contactFieldErrors.message_text) setContactFieldErrors({ ...contactFieldErrors, message_text: validateRequired(e.target.value, 'පණිවිඩය') });
                      }}
                      onBlur={e => setContactFieldErrors({ ...contactFieldErrors, message_text: validateRequired(e.target.value, 'පණිවිඩය') })}
                    />
                    <FormError>{contactFieldErrors.message_text}</FormError>
                  </div>

                  <Button type="submit" variant="primary" size="lg" fullWidth loading={contactStatus === 'loading'} icon={<Send size={18} />}>
                    {contactStatus === 'loading' ? 'යවමින් පවතී...' : 'පණිවිඩය යවන්න'}
                  </Button>
                </form>
              )}

              {contactStatus === 'success' && (
                <Button variant="outline" fullWidth className="mt-4" icon={<RotateCcw size={16} />} onClick={() => setContactStatus('idle')}>
                  තවත් පණිවිඩයක් යවන්න
                </Button>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-primary-dark to-primary text-white pt-16 px-[5%] pb-6 border-t-4 border-primary-light">
        <div className="flex justify-between flex-wrap gap-10 mb-10">
          <div className="flex-1 min-w-[250px]">
            <div className="flex items-center gap-4 mb-5">
              <img src="/Project%20LOGO.png" alt="Logo" className="w-12 bg-white rounded-full p-1.5" />
              <h3 className="m-0 text-2xl text-indigo-100">Thusitha Smart Academy</h3>
            </div>
            <p className="text-sm leading-loose opacity-80">දිවයිනේ ප්‍රමුඛතම අධ්‍යාපන ආයතනයක් ලෙස නවීන තාක්ෂණය සමඟින් දරුවන්ගේ අනාගතය සුබදායී කිරීමට අපි කැපවී සිටින්නෙමු.</p>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h4 className="text-indigo-100 mb-5 font-bold">Quick Links</h4>
            <ul className="list-none p-0 space-y-2.5">
              <li><a href="#home" className="text-indigo-200 no-underline hover:text-white transition-colors">මුල් පිටුව</a></li>
              <li><a href="/courses" className="text-indigo-200 no-underline hover:text-white transition-colors">පන්ති</a></li>
              <li><a href="/teachers" className="text-indigo-200 no-underline hover:text-white transition-colors">ගුරු මඩුල්ල</a></li>
            </ul>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h4 className="text-indigo-100 mb-5 font-bold">සම්බන්ධ වන්න</h4>
            <p className="text-sm mb-2.5 flex items-center gap-2"><MapPin size={14} /> Thusitha Education Center, Gampaha</p>
            <p className="text-sm mb-2.5 flex items-center gap-2"><Phone size={14} /> 033-2238380</p>
            <p className="text-sm flex items-center gap-2"><Mail size={14} /> info@thusitha.edu</p>
          </div>
        </div>
        <div className="text-center border-t border-white/10 pt-5 text-xs opacity-60">
          &copy; {new Date().getFullYear()} Thusitha Smart Academy. All Rights Reserved.
        </div>
      </footer>

      {/* Registration Modal Popup */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="ලියාපදිංචි වන්න" maxWidth="max-w-lg">
        <p className="text-center text-slate-500 mb-6 text-sm">ඔබේ තොරතුරු ඇතුළත් කර පන්තියට අදාළ අසුනක් වෙන් කරවා ගන්න.</p>

        <form onSubmit={handlePreRegister}>
          <div className="mb-4">
            <Label htmlFor="student_name">ශිෂ්‍යයාගේ නම</Label>
            <Input id="student_name" type="text" value={formData.student_name} onChange={e => setFormData({ ...formData, student_name: e.target.value })} required />
          </div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <Label htmlFor="school">පාසල</Label>
              <Input id="school" type="text" value={formData.school} onChange={e => setFormData({ ...formData, school: e.target.value })} />
            </div>
            <div className="flex-1">
              <Label htmlFor="grade">ශ්‍රේණිය</Label>
              <Input id="grade" type="text" value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} />
            </div>
          </div>
          <div className="mb-4">
            <Label htmlFor="parent_name">මව්පිය / භාරකාර නම</Label>
            <Input id="parent_name" type="text" value={formData.parent_name} onChange={e => setFormData({ ...formData, parent_name: e.target.value })} required />
          </div>
          <div className="mb-4">
            <Label htmlFor="parent_phone">දෙමාපිය දුරකථන අංකය</Label>
            <Input id="parent_phone" type="tel" value={formData.parent_phone} onChange={e => setFormData({ ...formData, parent_phone: e.target.value })} required />
          </div>
          <div className="mb-4">
            <Label htmlFor="course_id">උනන්දුවක් දක්වන පන්තිය (Interested Course)</Label>
            <Select id="course_id" value={formData.course_id} onChange={e => setFormData({ ...formData, course_id: e.target.value })} required>
              <option value="">-- පන්තියක් තෝරන්න --</option>
              {courses.map(c => (
                <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
              ))}
            </Select>
          </div>
          <div className="mb-6">
            <Label htmlFor="email">ඊමේල් ලිපිනය (ඇත්නම්)</Label>
            <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth>
            ලියාපදිංචි කිරීම තහවුරු කරන්න
          </Button>
        </form>
      </Modal>

      {/* Lightbox Preview Modal */}
      {previewImage && ReactDOM.createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[10000] cursor-zoom-out"
        >
          <div className="relative max-w-[90%] max-h-[90%]" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              aria-label="Close preview"
              className="absolute -top-11 right-0 bg-white/20 hover:bg-white/40 text-white border-none rounded-full w-9 h-9 flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border-[3px] border-white/10"
            />
          </div>
        </motion.div>,
        document.body
      )}
    </div>
  );
};

export default LandingPage;
