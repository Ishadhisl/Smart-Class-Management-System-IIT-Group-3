import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';
import {
  Printer, Users, BookOpen, TrendingUp, CheckCircle, GraduationCap, Calendar,
  Sparkles, Zap, Clock, CreditCard, ClipboardList, BarChart2, Activity
} from 'lucide-react';
import { API_URL } from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

// Time-based greeting helper
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'සුභ උදෑසනක්', emoji: '🌅', period: 'morning' };
  if (hour < 17) return { text: 'සුභ දවසක්', emoji: '☀️', period: 'afternoon' };
  return { text: 'සුභ සන්ධ්‍යාවක්', emoji: '🌙', period: 'evening' };
};

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/teachers/') || path.startsWith('/achievers/') || path.startsWith('/flyers/')) return path;
  const cleanPath = path.replace(/\\/g, '/');
  const prefix = cleanPath.startsWith('/') ? '' : '/';
  return `${API_URL}${prefix}${cleanPath}`;
};

const HomeTab = ({ username, role, studentCount, userCount, enrolledCourses, revenueData, currentMonthRevenue, attendanceData, profilePhotoPath }) => {
  const isStudent = role === 'Student';
  const isParent = role === 'Parent';
  const greeting = useMemo(() => getGreeting(), []);

  if (isParent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-8"
      >
        {/* Welcome Header */}
        <div className="flex justify-between items-center bg-white/60 backdrop-blur-lg p-8 rounded-2xl shadow-sm border border-white/50">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-full shadow-md">
              <img src="/Project%20LOGO.png" alt="Logo" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h2 className="m-0 text-2xl font-bold text-primary-dark">ආයුබෝවන්, {username}! 👋</h2>
              <p className="text-gray-500 text-sm mt-1 font-semibold">මව්පිය ද්වාරය වෙත සාදරයෙන් පිළිගනිමු.</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/60 text-center max-w-2xl mx-auto">
          <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
          <h3 className="text-xl font-bold text-primary-dark mb-4">ඔබේ දරුවන්ගේ අධ්‍යයන කටයුතු නිරීක්ෂණය කරන්න</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">
            පැමිණීමේ වාර්තා, විභාග ලකුණු සහ මාසික පන්ති ගාස්තු ගෙවීම් පත්‍රිකා උඩුගත කිරීම ඇතුළු සියලුම සේවාවන් සඳහා වම්පස ඇති <strong>"මගේ දරුවන්"</strong> ටැබ් එක භාවිතා කරන්න.
          </p>
        </div>
      </motion.div>
    );
  }

  const isAdminRole = role === 'Admin';
  const canSeeIncome = role === 'Admin' || role === 'Counter Person' || role === 'Teacher';
  const hasCurrentMonthRevenue = typeof currentMonthRevenue === 'number';
  const actualRevenueData = Array.isArray(revenueData) ? revenueData : [];
  const hasRevenueData = actualRevenueData.length > 0;

  const chartData = {
    labels: actualRevenueData.map(d => d.month),
    datasets: [
      {
        label: 'මාසික ආදායම (Monthly Revenue)',
        data: actualRevenueData.map(d => d.total),
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
        borderColor: '#4f46e5',
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: '#4f46e5',
      },
    ],
  };

  const actualAttendanceData = Array.isArray(attendanceData) ? attendanceData : [];
  const hasAttendanceData = actualAttendanceData.length > 0;

  const attendanceDoughnutData = {
    labels: actualAttendanceData.map(d => d.class_name),
    datasets: [
      {
        data: actualAttendanceData.map(d => Number(d.total_present) || 0),
        backgroundColor: [
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(59, 130, 246, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(236, 72, 153, 0.85)',
        ],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  // =============================================
  // STUDENT VIEW: Shows enrolled courses only
  // =============================================
  if (isStudent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-8"
      >
        {/* Welcome Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-8 rounded-3xl shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -ml-8 -mb-8" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm p-1 rounded-2xl">
              {profilePhotoPath ? (
                <img src={getImageUrl(profilePhotoPath)} alt="Profile" className="w-14 h-14 object-cover rounded-xl" />
              ) : (
                <img src="/default-avatar.svg" alt="Profile" className="w-14 h-14 object-contain rounded-xl" />
              )}
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium">{greeting.text} {greeting.emoji}</p>
              <h2 className="m-0 text-2xl font-bold text-white">ආයුබෝවන්, {username}! 👋</h2>
              <p className="text-white/80 text-sm mt-1">ඔබගේ ඉගෙනුම් ස්ථානය සූදානම්!</p>
            </div>
          </div>
        </div>

        {/* Enrolled Courses */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><GraduationCap size={24} /></div>
            <h3 className="text-xl font-bold text-primary-dark m-0">ඔබ ලියාපදිංචි වී ඇති පන්ති</h3>
          </div>
          {enrolledCourses && enrolledCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrolledCourses.map((course, idx) => (
                <motion.div
                  key={course.course_id || idx}
                  whileHover={{ y: -3 }}
                  className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-5 rounded-2xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-3 rounded-xl text-primary shrink-0">
                      <BookOpen size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 m-0">{course.course_name}</h4>
                      {course.teacher_name && (
                        <p className="text-sm text-gray-500 mt-1">👨‍🏫 {course.teacher_name}</p>
                      )}
                      {course.schedule_day && (
                        <p className="text-sm text-indigo-600 mt-1 flex items-center gap-1">
                          <Calendar size={13} /> {course.schedule_day} {course.start_time && `• ${course.start_time}`}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">ඔබ තවම කිසිදු පන්තියකට ලියාපදිංචි වී නැත.</p>
              <p className="text-sm mt-1">ලියාපදිංචිය සඳහා ප්‍රතිමාව කාර්යාලය හා සම්බන්ධ වන්න.</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // =============================================
  // ADMIN / TEACHER / COUNTER PERSON VIEW
  // =============================================

  // Quick action items based on role
  const quickActions = [
    { icon: Users, label: 'ශිෂ්‍ය ලේඛනය', tab: 'students', gradient: 'from-blue-500 to-indigo-600' },
    { icon: ClipboardList, label: 'පැමිණීම', tab: 'attendance', gradient: 'from-green-500 to-emerald-600' },
    { icon: CreditCard, label: 'ගෙවීම්', tab: 'payments', gradient: 'from-purple-500 to-violet-600' },
    { icon: BookOpen, label: 'පන්ති', tab: 'class_management', gradient: 'from-orange-500 to-amber-600' },
  ];

  // Today's date formatted
  const today = new Date().toLocaleDateString('si-LK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Admin and Counter Person both see the total non-student account count here; Teacher sees
  // their own course count instead, so it gets a distinct label.
  const userCountLabel = role === 'Teacher' ? 'පන්ති' : 'පරිශීලකයින්';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="printable-content flex flex-col gap-7"
    >
      {/* Welcome Banner — Animated Gradient */}
      <div className="relative overflow-hidden rounded-3xl shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-dark via-primary to-indigo-500" />
        <motion.div
          className="absolute inset-0 opacity-40"
          animate={{
            background: [
              'radial-gradient(circle at 0% 50%, rgba(236,72,153,0.5) 0%, transparent 50%)',
              'radial-gradient(circle at 100% 50%, rgba(129,140,248,0.5) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 100%, rgba(6,182,212,0.4) 0%, transparent 50%)',
              'radial-gradient(circle at 0% 50%, rgba(236,72,153,0.5) 0%, transparent 50%)',
            ]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        />
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white/5 rounded-full -mb-20" />
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-6 right-10 text-white/10"
        >
          <Sparkles size={60} />
        </motion.div>

        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-5">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="bg-white/15 backdrop-blur-sm p-3 rounded-2xl border border-white/20 shadow-lg"
            >
              {profilePhotoPath ? (
                <img src={getImageUrl(profilePhotoPath)} alt="Profile" className="w-14 h-14 object-cover rounded-xl" />
              ) : (
                <img src="/Project%20LOGO.png" alt="Logo" className="w-14 h-14 object-contain" />
              )}
            </motion.div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white/60 text-sm font-medium">{greeting.text} {greeting.emoji}</span>
                <span className="bg-white/15 text-white/80 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{role}</span>
              </div>
              <h2 className="m-0 text-3xl font-extrabold text-white">ආයුබෝවන්, {username}!</h2>
              <div className="flex items-center gap-2 mt-2 text-white/60 text-sm">
                <Clock size={14} />
                <span>{today}</span>
              </div>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => globalThis.print()}
            className="flex items-center gap-2 px-5 py-3 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-xl font-semibold transition-colors border border-white/20"
          >
            <Printer size={18} /> Print Dashboard
          </motion.button>
        </div>
      </div>

      {/* Stat Cards — Gradient Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            icon: Users, label: 'මුළු සිසුන්', value: studentCount,
            gradient: 'from-blue-500 to-indigo-600', bgLight: 'bg-blue-50', iconColor: 'text-blue-600'
          },
          {
            icon: BookOpen, label: userCountLabel, value: userCount,
            gradient: 'from-pink-500 to-rose-600', bgLight: 'bg-pink-50', iconColor: 'text-pink-600'
          },
          ...(canSeeIncome ? [{
            icon: TrendingUp, label: 'මෙම මාසයේ ආදායම',
            value: hasCurrentMonthRevenue ? `Rs.${currentMonthRevenue.toLocaleString()}` : 'දත්ත නැත',
            gradient: 'from-emerald-500 to-green-600', bgLight: 'bg-emerald-50', iconColor: 'text-emerald-600'
          }] : []),
          {
            icon: CheckCircle, label: 'අද පැමිණීම',
            value: hasAttendanceData ? actualAttendanceData.reduce((sum, d) => sum + (Number(d.total_present ?? d.count) || 0), 0) : 'දත්ත නැත',
            gradient: 'from-amber-500 to-orange-600', bgLight: 'bg-amber-50', iconColor: 'text-amber-600'
          }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100/80 overflow-hidden group cursor-default"
            >
              {/* Hover gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
              <div className="relative z-10">
                <div className={`${stat.bgLight} p-3 rounded-xl inline-flex mb-4`}>
                  <Icon size={24} className={stat.iconColor} />
                </div>
                <p className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">{stat.label}</p>
                <h3 className="text-3xl font-extrabold text-gray-800 m-0">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </h3>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/60">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={20} className="text-amber-500" />
          <h3 className="text-lg font-bold text-primary-dark m-0">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={i}
                type="button"
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('changeTab', { detail: action.tab }));
                }}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br ${action.gradient} text-white shadow-md hover:shadow-lg transition-shadow border-none cursor-pointer`}
              >
                <Icon size={28} />
                <span className="text-sm font-bold">{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdminRole && (
          <div className="col-span-2 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/60">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-md">
                  <BarChart2 size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primary-dark m-0">මාසික ආදායම් විශ්ලේෂණය</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Revenue Analytics</p>
                </div>
              </div>
              <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <Activity size={12} /> Live
              </div>
            </div>
            {hasRevenueData ? (
              <div className="h-[350px]">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
                        ticks: { padding: 10 }
                      },
                      x: {
                        grid: { display: false },
                        ticks: { padding: 5 }
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-gray-400 text-sm font-medium">
                මෙතෙක් ආදායම් දත්ත සටහන් වී නැත.
              </div>
            )}
          </div>
        )}

        <div className={isAdminRole ? 'col-span-1 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/60' : 'col-span-1 lg:col-span-3 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/60'}>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl text-white shadow-md">
              <CheckCircle size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary-dark m-0">අද පැමිණීම</h3>
              <p className="text-gray-400 text-xs mt-0.5">Today's Attendance</p>
            </div>
          </div>
          {hasAttendanceData ? (
            <div className="h-[300px] flex justify-center mt-6">
              <Doughnut
                data={attendanceDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '72%',
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { usePointStyle: true, padding: 15, font: { weight: 'bold' } }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm font-medium">
              අද දින පැමිණීම් දත්ත තවම සටහන් වී නැත.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

HomeTab.propTypes = {
  username: PropTypes.string.isRequired,
  role: PropTypes.string,
  studentCount: PropTypes.number.isRequired,
  userCount: PropTypes.number.isRequired,
  enrolledCourses: PropTypes.array,
  revenueData: PropTypes.arrayOf(
    PropTypes.shape({
      month: PropTypes.string.isRequired,
      total: PropTypes.number.isRequired,
    })
  ).isRequired,
  currentMonthRevenue: PropTypes.number,
  attendanceData: PropTypes.arrayOf(
    PropTypes.shape({
      class_name: PropTypes.string,
      total_present: PropTypes.number,
    })
  ),
  profilePhotoPath: PropTypes.string,
};

export default HomeTab;