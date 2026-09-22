import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, User, FlaskConical, Atom, Monitor, Calculator, Globe, Microscope, Camera, Award, BookOpen } from 'lucide-react';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import StudentRegisterModal from './StudentRegisterModal';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Label from '../../components/common/Label';
import Textarea from '../../components/common/Textarea';
import Modal from '../../components/common/Modal';
import FormError from '../../components/common/FormError';
import {
  filterNameInput, filterPhoneInput, filterTextInput,
  NAME_INVALID_MSG, PHONE_INVALID_MSG, TEXT_INVALID_MSG,
  validateName, validatePhone, validateEmail, validateSubject, validateText,
} from '../../utils/formValidation';
import { useFieldValidation } from '../../utils/useFieldValidation';

// Keyword → { icon, gradient } lookup for course header art. Matched against
// subject_name (falling back to course_name) case-insensitively; first match wins.
// Falls back to the original default gradient/icon when nothing matches.
const SUBJECT_THEMES = [
  { keywords: ['chemistry'], icon: FlaskConical, gradient: 'from-purple-700 to-violet-500' },
  { keywords: ['physics'], icon: Atom, gradient: 'from-blue-700 to-sky-500' },
  { keywords: ['ict', 'computer'], icon: Monitor, gradient: 'from-cyan-700 to-teal-500' },
  { keywords: ['math'], icon: Calculator, gradient: 'from-orange-700 to-amber-500' },
  { keywords: ['geography'], icon: Globe, gradient: 'from-green-700 to-emerald-500' },
  { keywords: ['science'], icon: Microscope, gradient: 'from-emerald-700 to-teal-500' },
  { keywords: ['media'], icon: Camera, gradient: 'from-pink-700 to-rose-500' },
  { keywords: ['scholarship'], icon: Award, gradient: 'from-amber-700 to-yellow-500' },
  { keywords: ['sinhala', 'literature'], icon: BookOpen, gradient: 'from-red-700 to-rose-500' },
];
const DEFAULT_THEME = { icon: GraduationCap, gradient: 'from-primary-dark to-primary' };

const getCourseTheme = (course) => {
  const haystack = `${course?.subject_name || ''} ${course?.course_name || ''}`.toLowerCase();
  const match = SUBJECT_THEMES.find(theme => theme.keywords.some(kw => haystack.includes(kw)));
  return match || DEFAULT_THEME;
};

const CoursesPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Student Registration State (opens the shared modal right here, pre-selecting whichever
  // course's "ලියාපදිංචි වන්න" button was clicked - previously this routed the visitor away
  // to the home page instead, where the modal often opened without the course pre-selected)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null);

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

  const teacherRules = (d) => ({
    name: () => validateName(d.name, { label: 'නම' }),
    phone: () => validatePhone(d.phone, { required: true }),
    subject: () => validateSubject(d.subject, { label: 'විෂයය' }),
    email: () => validateEmail(d.email, { required: false }),
    qualifications: () => validateText(d.qualifications, { required: true, label: 'සුදුසුකම්', max: 300 }),
    bio: () => validateText(d.bio, { required: true, label: 'දේශක විස්තරය', min: 20, max: 1000 }),
  });
  const tv = useFieldValidation(teacherForm, setTeacherForm, teacherRules, {
    name: 'teacher_name', phone: 'teacher_phone', subject: 'teacher_subject',
    email: 'teacher_email', qualifications: 'teacher_qualifications', bio: 'teacher_bio',
  });

  const closeTeacherModal = () => {
    setIsTeacherModalOpen(false);
    tv.clear();
  };

  const handleTeacherRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!tv.validateAll()) {
      showNotification('කරුණාකර රතු පාටින් සලකුණු කර ඇති තොරතුරු නිවැරදි කරන්න.', 'error');
      return;
    }
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
      showNotification('දේශක ලියාපදිංචි වීමේ අයදුම්පත සාර්ථකව ඉදිරිපත් කරන ලදී! පාලක මඩුල්ල විසින් ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත.');
      closeTeacherModal();
      setTeacherForm({ name: '', phone: '', email: '', subject: '', qualifications: '', bio: '' });
    } catch (err) {
      console.error('Teacher registration submit error:', err);
      showNotification(err.message || 'ඉදිරිපත් කිරීමට නොහැකි විය. නැවත උත්සාහ කරන්න.', 'error');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/85 backdrop-blur-md px-[5%] py-4 flex justify-between items-center shadow-sm sticky top-0 z-[100] border-b border-indigo-100">
        <button type="button" className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0" onClick={() => navigate('/')}>
          <img src="/Project%20LOGO.png" alt="Logo" className="w-10" />
          <h2 className="m-0 text-primary-dark text-xl font-bold">Thusitha Smart Academy</h2>
        </button>
        <Button variant="outline" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>
          ආපසු (Back)
        </Button>
      </header>

      <main className="px-[5%] py-16">
        {/* Breadcrumbs */}
        <div className="mb-5 text-sm text-slate-500 flex items-center gap-2">
          <button type="button" onClick={() => navigate('/')} className="bg-transparent border-none p-0 cursor-pointer text-primary font-medium" aria-label="Go to Home Page">
            මුල් පිටුව
          </button>
          <span>›</span>
          <span className="text-primary-dark font-bold">අපගේ පන්ති</span>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-primary-dark text-4xl font-bold mb-4">අපගේ පන්ති සහ කාලසටහන්</h1>
          <p className="text-slate-500">ඔබට ගැලපෙන විෂය සහ වේලාව තෝරාගන්න. ලියාපදිංචි වීමට පන්තිය මත ක්ලික් කරන්න.</p>
          <Button variant="success" className="!rounded-full mt-4" icon={<User size={16} />} onClick={() => setIsTeacherModalOpen(true)}>
            දේශකයා (Teacher) ලියාපදිංචි වන්න
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-primary">පූරණය වෙමින්...</div>
        ) : (
          <div className="grid gap-7" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {courses.length > 0 ? courses.map(course => {
              const theme = getCourseTheme(course);
              const ThemeIcon = theme.icon;
              return (
                <Card key={course.course_id} hover padding="p-0" className="!rounded-2xl overflow-hidden flex flex-col">
                  <div className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} p-5 text-white`}>
                    <ThemeIcon size={96} strokeWidth={1.5} className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none" aria-hidden="true" />
                    <h3 className="relative m-0 text-lg font-bold">{course.course_name}</h3>
                    <div className="relative text-[13px] opacity-80 mt-1">{course.subject_name}</div>
                  </div>

                  <div className="p-6 flex-grow">
                    <div className="mb-4">
                      <small className="text-slate-400 font-bold block">දේශකයා (Teacher)</small>
                      <div className="text-primary text-lg font-bold">{course.lecturer_name || 'විස්තර ලබා ගත නොහැක'}</div>
                    </div>

                    <div className="mb-4">
                      <small className="text-slate-400 font-bold block">පන්ති කාලසටහන</small>
                      <div className="text-slate-600 text-sm font-medium">{course.schedule_text || 'කාලසටහන ලබා ගත නොහැක'}</div>
                    </div>

                    <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100">
                      <div>
                        <small className="text-slate-400 font-bold block">මාසික ගාස්තුව</small>
                        <div className="text-success text-xl font-extrabold">Rs. {course.monthly_fee}</div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className="!rounded-full"
                        onClick={() => {
                          setSelectedCourseId(course.course_id);
                          setIsRegisterModalOpen(true);
                        }}
                      >
                        ලියාපදිංචි වන්න
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            }) : (
              <div className="text-center col-span-full text-slate-400">පන්ති දත්ත සොයාගත නොහැක.</div>
            )}
          </div>
        )}
      </main>

      {/* Student Registration Modal */}
      <StudentRegisterModal
        open={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        courses={courses}
        initialCourseId={selectedCourseId}
      />

      {/* Teacher Registration Modal */}
      <Modal open={isTeacherModalOpen} onClose={closeTeacherModal} title="දේශකයා (Teacher) ලියාපදිංචිය" maxWidth="max-w-lg">
        <p className="text-center text-slate-500 mb-1 text-[13px]">ඔබේ තොරතුරු ඇතුළත් කර අයදුම්පත ඉදිරිපත් කරන්න.</p>
        <p className="text-center text-slate-400 mb-5 text-xs"><span className="text-danger">*</span> සලකුණු කළ තොරතුරු අනිවාර්ය වේ.</p>

        <form onSubmit={handleTeacherRegisterSubmit} noValidate>
          <div className="mb-4">
            <Label htmlFor="teacher_name">නම <span className="text-danger">*</span></Label>
            <Input id="teacher_name" type="text" placeholder="උදා: Nimal Perera / නිමල් පෙරේරා" maxLength={150}
              value={teacherForm.name} invalid={tv.invalid('name')}
              onChange={e => tv.set('name', e.target.value, filterNameInput, NAME_INVALID_MSG)}
              onBlur={() => tv.blur('name')} />
            <FormError>{tv.errors.name}</FormError>
          </div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <Label htmlFor="teacher_phone">දුරකථනය <span className="text-danger">*</span></Label>
              <Input id="teacher_phone" type="tel" inputMode="numeric" placeholder="උදා: 0771234567" maxLength={12}
                value={teacherForm.phone} invalid={tv.invalid('phone')}
                onChange={e => tv.set('phone', e.target.value, filterPhoneInput, PHONE_INVALID_MSG)}
                onBlur={() => tv.blur('phone')} />
              <FormError>{tv.errors.phone}</FormError>
            </div>
            <div className="flex-1">
              <Label htmlFor="teacher_subject">විෂයය <span className="text-danger">*</span></Label>
              <Input id="teacher_subject" type="text" placeholder="උදා: A/L Physics" maxLength={100}
                value={teacherForm.subject} invalid={tv.invalid('subject')}
                onChange={e => tv.set('subject', e.target.value, filterTextInput, TEXT_INVALID_MSG)}
                onBlur={() => tv.blur('subject')} />
              <FormError>{tv.errors.subject}</FormError>
            </div>
          </div>
          <div className="mb-4">
            <Label htmlFor="teacher_email">ඊමේල් ලිපිනය</Label>
            <Input id="teacher_email" type="email" placeholder="උදා: nimal@gmail.com" maxLength={150}
              value={teacherForm.email} invalid={tv.invalid('email')}
              onChange={e => tv.set('email', e.target.value, filterTextInput, TEXT_INVALID_MSG, { live: true })}
              onBlur={() => tv.blur('email')} />
            <FormError>{tv.errors.email}</FormError>
          </div>
          <div className="mb-4">
            <Label htmlFor="teacher_qualifications">සුදුසුකම් <span className="text-danger">*</span></Label>
            <Input id="teacher_qualifications" type="text" placeholder="උදා: BSc (Physics), PGDE" maxLength={300}
              value={teacherForm.qualifications} invalid={tv.invalid('qualifications')}
              onChange={e => tv.set('qualifications', e.target.value, filterTextInput, TEXT_INVALID_MSG)}
              onBlur={() => tv.blur('qualifications')} />
            <FormError>{tv.errors.qualifications}</FormError>
          </div>
          <div className="mb-6">
            <Label htmlFor="teacher_bio">දේශක විස්තරය (Bio) <span className="text-danger">*</span></Label>
            <Textarea id="teacher_bio" rows={4} maxLength={1000}
              placeholder="උදා: වසර 10ක ඉගැන්වීමේ පළපුරුද්ද, A/L Physics theory සහ revision පන්ති..."
              value={teacherForm.bio} invalid={tv.invalid('bio')}
              onChange={e => tv.set('bio', e.target.value, filterTextInput, TEXT_INVALID_MSG)}
              onBlur={() => tv.blur('bio')} />
            <FormError>{tv.errors.bio}</FormError>
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth loading={teacherRegistering} icon={<GraduationCap size={18} />}>
            {teacherRegistering ? 'යවමින් පවතී...' : 'අයදුම්පත ඉදිරිපත් කරන්න'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default CoursesPage;
