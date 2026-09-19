import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, CalendarDays } from 'lucide-react';
import { request, API_URL } from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Avatar from '../../components/common/Avatar';

const TeachersPage = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const getImageUrl = (path) => {
    if (!path) return null;
    // path from the DB (e.g. '/uploads/photo-....png') already carries a leading slash -
    // blindly inserting another '/' here produced a double-slash URL that 404'd (Express's
    // static mount doesn't collapse it), which is why Sandaruwan's photo stayed a "?"
    // placeholder even after the substring-match fix. See LandingPage.jsx's getImageUrl.
    const normalizedPath = path.replace(/\\/g, '/');
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const finalPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    return `${baseUrl}${finalPath}`;
  };

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
        if (data && data.length > 0) {
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
            // A real uploaded photo always wins - see LandingPage.jsx's getTeacherPhoto
            // for why (a substring match like "Sandaruwan" containing "ruwan" would
            // otherwise swap in a different teacher's placeholder portrait).
            if (dbPath) return getImageUrl(dbPath);
            const nameLower = name?.toLowerCase() || '';
            for (const [key, path] of Object.entries(teacherPhotoMap)) {
              if (nameLower.includes(key)) return path;
            }
            return null;
          };

          // Deduplicate by name
          const uniqueTeachers = Array.from(new Map(data.map(t => [t.lecturer_name, t])).values());

          const mapped = uniqueTeachers.map(t => ({
            ...t,
            custom_photo: getTeacherPhoto(t.lecturer_name, t.profile_photo_path)
          }));
          setTeachers(mapped);
        } else {
          setTeachers([]);
        }
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
          <span className="text-primary-dark font-bold">ගුරු මඩුල්ල</span>
        </div>

        <div className="text-center mb-14">
          <h1 className="text-primary-dark text-4xl font-bold mb-4">දිවයිනේ ප්‍රමුඛතම ගුරු මඩුල්ල</h1>
          <p className="text-slate-500 max-w-2xl mx-auto">ඔබේ අධ්‍යාපන සිහින සැබෑ කර දෙන, වසර ගණනාවක පළපුරුද්දක් සහිත අපගේ දක්ෂ දේශක මඩුල්ල සමඟ අදම එක්වන්න.</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="max-w-xl mx-auto mb-12 relative">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="විෂය (Physics, IT...) හෝ දේශකයාගේ නම සොයන්න..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="!rounded-full !pl-12 !py-3.5"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-primary">පූරණය වෙමින් පවතී...</div>
        ) : (
          <div className="grid gap-9 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {filteredTeachers.length > 0 ? filteredTeachers.map(teacher => (
              <Card
                key={teacher.lecturer_id}
                hover
                padding="p-9 px-6"
                className="text-center !rounded-2xl cursor-pointer"
                onClick={() => navigate('/courses')}
              >
                <Avatar 
                  src={teacher.custom_photo} 
                  alt={teacher.lecturer_name} 
                  size="3xl" 
                  className="mx-auto shadow-md mb-6 ring-4 ring-primary-light/20 bg-indigo-50/50" 
                  fallback={
                    <div className="bg-primary/10 text-primary-dark w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold uppercase shadow-sm">
                      {teacher.lecturer_name.substring(0, 2)}
                    </div>
                  }
                />
                <h3 className="text-xl font-bold text-slate-800 m-0 mb-1">{teacher.lecturer_name}</h3>
                <div className="text-primary-light font-bold text-xs mb-4 uppercase tracking-wide">
                  {teacher.specialization}
                </div>

                <p className="text-slate-500 text-sm leading-relaxed mb-5">
                  {teacher.bio || "අධ්‍යාපන ක්ෂේත්‍රයේ ප්‍රවීණ දේශකයෙක්."}
                </p>

                <div className="inline-flex items-center gap-1.5 border border-primary text-primary px-4 py-2 rounded-full text-xs font-bold">
                  <CalendarDays size={13} /> පන්ති කාලසටහන බලන්න
                </div>
              </Card>
            )) : (
              <p className="text-center col-span-full text-slate-400">දේශකයන්ගේ විස්තර සොයාගත නොහැක.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeachersPage;
