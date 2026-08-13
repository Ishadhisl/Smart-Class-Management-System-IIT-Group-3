import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { request } from '../../services/api';
import { 
  Home, Users, Clock, Settings, Calendar, LogOut, 
  BookOpen, CreditCard, ClipboardList, MessageSquare, 
  Smartphone, FileText, Camera, ShieldCheck,
  ChevronLeft, ChevronRight, Menu, Activity, BarChart2, Video, QrCode
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, onLogout, role }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288); // Default 72rem = 288px
  const [isResizing, setIsResizing] = useState(false);

  const userData = sessionStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  useEffect(() => {
    const handleTabChange = (e) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, [setActiveTab]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 220) newWidth = 220; // Min expanded width
      if (newWidth > 450) newWidth = 450; // Max expanded width
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const currentWidth = isCollapsed ? 80 : sidebarWidth;

  const getButtonStyle = (tabName) => `
    w-full ${isCollapsed ? 'px-0 justify-center' : 'px-4 justify-start'} py-3 cursor-pointer rounded-xl flex items-center gap-4
    transition-all duration-300 ease-in-out relative group text-left leading-tight
    ${activeTab === tabName 
      ? `bg-white/20 font-bold shadow-glass text-white ${!isCollapsed ? 'translate-x-2' : ''}` 
      : `bg-transparent border-transparent hover:bg-white/10 text-indigo-100 hover:text-white font-medium ${!isCollapsed ? 'hover:translate-x-1' : ''}`
    }
  `;

  const renderButton = (tabName, icon, label) => (
    <button 
      title={isCollapsed ? label : ''}
      type="button" 
      onClick={() => setActiveTab(tabName)} 
      className={getButtonStyle(tabName)}
    >
      <div className="shrink-0">{icon}</div>
      {!isCollapsed && <span className="whitespace-normal flex-1">{label}</span>}
    </button>
  );

  const isAdmin = role === 'Admin';
  const isCounterPerson = role === 'Counter Person';
  const isTeacher = role === 'Teacher';
  const isStudent = role === 'Student';

  return (
    <motion.div 
      initial={{ x: -260 }}
      animate={{ x: 0, width: currentWidth }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white flex flex-col py-6 px-3 shadow-2xl z-20 h-full relative shrink-0"
    >
      {/* Resizer Handle */}
      {!isCollapsed && (
        <div 
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-white/20 z-50 transition-colors"
          onMouseDown={() => setIsResizing(true)}
        />
      )}
      
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-8 bg-white text-primary rounded-full p-1.5 shadow-glass z-50 hover:scale-110 transition-transform"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/30 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/30 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div 
              key="expanded-header"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-center mb-8 pb-6 border-b border-white/20"
            >
              <motion.img 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                src="/Project%20LOGO.png" 
                alt="Thusitha Logo" 
                className="w-20 h-20 rounded-2xl mx-auto mb-4 bg-white/90 p-2 shadow-glass backdrop-blur-md"
              />
              <h2 className="m-0 text-lg font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200 leading-tight">Thusitha Academy</h2>
              <p className="text-[10px] text-accent-light mt-1 font-bold tracking-widest uppercase">{role}</p>
            </motion.div>
          ) : (
            <motion.div 
              key="collapsed-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center mb-8 pb-6 border-b border-white/20 flex flex-col items-center gap-2"
            >
              <img src="/Project%20LOGO.png" alt="Logo" className="w-10 h-10 rounded-xl bg-white/90 p-1 shadow-glass" />
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="flex flex-col overflow-y-auto overflow-x-hidden flex-1 mb-6 gap-1 custom-scrollbar pr-1">
          {renderButton('home', <Home size={20}/>, 'මුල් පිටුව')}
          {role === 'Parent' && renderButton('parent_portal', <Users size={20}/>, 'මගේ දරුවන්')}
          
          {['Admin', 'Counter Person', 'Teacher'].includes(role) && renderButton('students', <Users size={20}/>, 'ශිෂ්‍ය ලේඛනය')}
          
          {isAdmin && renderButton('teachers', <Users size={20}/>, 'ගුරු ලේඛනය')}

          {role === 'Counter Person' && renderButton('approvals', <Clock size={20}/>, 'ශිෂ්‍ය අනුමැතිය')}

          {isAdmin && (
            <>
              {renderButton('class_management', <BookOpen size={20}/>, 'පන්ති කලමනාකරණය')}
              {renderButton('classes', <Users size={20}/>, 'පරිශීලකයින්')}
              {renderButton('announcements', <MessageSquare size={20}/>, 'නිවේදන')}
              {renderButton('achievements', <FileText size={20}/>, 'ජයග්‍රහණ')}
              {renderButton('promos', <MessageSquare size={20}/>, 'ප්‍රවර්ධන')}
              {renderButton('admin_hub', <Settings size={20}/>, 'සන්නිවේදන මධ්‍යස්ථානය')}
            </>
          )}

          {(isTeacher || isStudent) && renderButton('my_timetable', <Calendar size={20}/>, 'මගේ කාලසටහන')}
          

          {(isAdmin || isCounterPerson) && renderButton('enrollment', <ClipboardList size={20}/>, 'ලියාපදිංචිය')}
          {(isAdmin || isCounterPerson) && renderButton('qr_attendance', <QrCode size={20}/>, 'QR Attendance')}
          {(role !== 'Parent' && !isTeacher) && renderButton('study_area', <BookOpen size={20}/>, 'අධ්‍යයන අංශය')}
          
          {(isAdmin || isCounterPerson || isStudent) && renderButton('payments', <CreditCard size={20}/>, 'ගෙවීම්')}
          
          {(isAdmin || isTeacher || isStudent) && renderButton('exams', <FileText size={20}/>, 'විභාග සහ ලකුණු')}
          
          {role !== 'Parent' && renderButton('materials', <FileText size={20}/>, 'ඉගෙනුම් ද්‍රව්‍ය')}
          
          {(isAdmin || isTeacher || isCounterPerson) && renderButton('attendance', <ClipboardList size={20}/>, 'පැමිණීම')}
          {(isAdmin || isTeacher) && renderButton('ai_panel', <Camera size={20}/>, 'AI නිරීක්ෂණය')}
          {(isAdmin || isCounterPerson) && renderButton('face_verification', <ShieldCheck size={20}/>, 'මුහුණු සත්‍යාපනය')}


          {isAdmin && (
            <>
              {renderButton('audit_logs', <Activity size={20}/>, 'පද්ධති විගණනය')}
            </>
          )}
        </nav>
      </div>
      
      <motion.button 
        whileHover={{ scale: 1.03, backgroundColor: '#e11d48' }}
        whileTap={{ scale: 0.95 }}
        type="button" 
        onClick={onLogout} 
        title={isCollapsed ? 'ඉවත් වන්න' : ''}
        className={`w-full py-3.5 bg-white/10 hover:bg-rose-600 text-white border border-white/20 hover:border-transparent rounded-xl font-bold mt-auto flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-center px-4'} gap-2 shadow-glass transition-all relative z-10 backdrop-blur-md`}
      >
        <div className="shrink-0"><LogOut size={20} /></div>
        {!isCollapsed && <span className="whitespace-nowrap">ඉවත් වන්න</span>}
      </motion.button>
    </motion.div>
  );
};

Sidebar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  role: PropTypes.string,
};

export default Sidebar;