import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { studentService } from '../../services/studentService';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Modular Components
import Sidebar from '../../components/Dashboard/Sidebar';
import StudentTab from '../../components/Dashboard/StudentTab';
import TeacherTab from '../../components/Dashboard/TeacherTab';
import AttendanceTab from '../../components/Dashboard/AttendanceTab';
import PaymentTab from '../../components/Dashboard/PaymentTab';
import StudentPaymentTab from '../../components/Dashboard/StudentPaymentTab';
import EnrollmentTab from '../../components/Dashboard/EnrollmentTab';
import UserTab from '../../components/Dashboard/UserTab';
import ApprovalTab from '../../components/Dashboard/ApprovalTab';
import HomeTab from '../../components/Dashboard/HomeTab';
import StudyAreaTab from '../../components/Dashboard/StudyAreaTab';
import ExamTab from '../../components/Dashboard/ExamTab';
import ContactTab from '../../components/Dashboard/ContactTab';
import SMSLogTab from '../../components/Dashboard/SMSLogTab';
import MaterialTab from '../../components/Dashboard/MaterialTab';
import ClassTab from '../../components/Dashboard/ClassTab';
import TimetableTab from '../../components/Dashboard/TimetableTab';
import SettingsTab from '../../components/Dashboard/SettingsTab';
import PromotionTab from '../../components/Dashboard/PromotionTab';
import SmartAttendanceLivePanel from '../../components/Dashboard/SmartAttendanceLivePanel';
import AuditLogTab from '../../components/Dashboard/AuditLogTab';
import AdminHubTab from '../../components/Dashboard/AdminHubTab';
import ParentPortalTab from '../../components/Dashboard/ParentPortalTab';
import FaceVerificationTab from '../../components/Dashboard/FaceVerificationTab';

import AnnouncementTab from '../../components/Dashboard/Tabs/AnnouncementTab';
import AchievementTab from '../../components/Dashboard/Tabs/AchievementTab';
import QRAttendanceTab from '../../components/Dashboard/QRAttendanceTab';

import { UserPlus, Settings2 } from 'lucide-react';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Label from '../../components/common/Label';
import Button from '../../components/common/Button';

const Dashboard = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const [activeTab, setActiveTab] = useState('home');
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [realCourses, setRealCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [myChildren, setMyChildren] = useState([]);
  const [studySeats, setStudySeats] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [halls, setHalls] = useState([]);
  const [parents, setParents] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState({ isReady: false, hasQr: false, status: 'Disconnected' });
  const [classSchedules, setClassSchedules] = useState([]);
  const [myTimetable, setMyTimetable] = useState([]);
  const [myProfilePhoto, setMyProfilePhoto] = useState(null);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [systemSettings, setSystemSettings] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [aiHealthStats, setAiHealthStats] = useState({});
  const [congestionData, setCongestionData] = useState([]);
  const [hallUtilData, setHallUtilData] = useState([]);
  const [punctualityData, setPunctualityData] = useState([]);
  const [teacherPerfData, setTeacherPerfData] = useState([]);
  const [suspiciousLogs, setSuspiciousLogs] = useState([]);
  const [suspiciousStartDate, setSuspiciousStartDate] = useState('');
  const [suspiciousEndDate, setSuspiciousEndDate] = useState('');
  const [punctualityStartDate, setPunctualityStartDate] = useState('');
  const [punctualityEndDate, setPunctualityEndDate] = useState('');
  const [punctualityCourse, setPunctualityCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add Student States
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [selectedParent, setSelectedParent] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Attendance States
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [selectedAttendanceCourse, setSelectedAttendanceCourse] = useState('');
  const [courseEnrolledStudents, setCourseEnrolledStudents] = useState([]);

  // Role-based permission helpers
  const isAdmin = user?.role === 'Admin';
  const isTeacher = user?.role === 'Teacher';
  const isCounterPerson = user?.role === 'Counter Person';
  const isStudent = user?.role === 'Student';
  const isParent = user?.role === 'Parent';
  const isAdminOrTeacher = isAdmin || isTeacher;
  const isAdminOrCounterPerson = isAdmin || isCounterPerson;
  const isAdminOrTeacherOrCounterPerson = isAdmin || isTeacher || isCounterPerson;
  const isStaff = isAdmin || isTeacher || isCounterPerson;

  // සජීවීව දත්ත ඇදගන්නා Role-Aware Function එක
  const fetchDatabaseData = async () => {
    setLoading(true);
    setError('');
    try {
      // Parent role: fetch only their children details
      if (isParent) {
        const childrenData = await request('/parents/my-children').catch(e => {
          console.error("Children error:", e);
          return [];
        });
        setMyChildren(childrenData || []);
        setLoading(false);
        return;
      }

      // Student role: only fetch what they are allowed
      if (isStudent) {
        // Students only need their enrolled courses & timetable
        const [courseData, enrolledData, timetableData, seatData, promoData, myProfileData] = await Promise.all([
          request('/courses').catch(() => []),
          request('/enrollments/my-courses').catch(() => []),
          request('/classes/my-timetable').catch(() => []),
          request('/study-area/seats').catch(() => []),
          request('/promos').catch(() => []),
          request('/students/me').catch(() => null),
        ]);
        setRealCourses(courseData || []);
        setEnrolledCourses(enrolledData || []);
        setMyTimetable(timetableData || []);
        setStudySeats(seatData || []);
        setPromotions(promoData || []);
        setMyProfilePhoto(myProfileData?.profile_photo_path || null);
        // Clear all admin-only state
        setAuditLogs([]);
        setAiHealthStats({});
        setCongestionData([]);
        setHallUtilData([]);
        setPunctualityData([]);
        setTeacherPerfData([]);
        setSuspiciousLogs([]);
        setStudents([]);
        setClasses([]);
        setParents([]);
        setLecturers([]);
        setSubjects([]);
        setHalls([]);
        setRevenueData([]);
        setAttendanceStats([]);
        setInquiries([]);
        setSmsLogs([]);
        setClassSchedules([]);
        setPendingStudents([]);
        setSystemSettings([]);
        return;
      }

      // ⏱️ Helper: reject a promise if it takes too long
      const withTimeout = (promise, ms, fallback) => {
        const timeout = new Promise(resolve => setTimeout(() => resolve(fallback), ms));
        return Promise.race([promise, timeout]);
      };

      // Staff roles: fetch based on their specific permissions
      const [
        studentData,
        classData,
        parentData,
        courseData,
        lecturerData,
        subjectData,
        hallData,
        revData,
        attData,
        msgData,
        seatData,
        smsData,
        schedulesData,
        promoData,
        auditData,
        healthData,
        congestionInfo,
        hallUtilInfo,
        punctualityInfo,
        teacherPerfInfo
      ] = await Promise.all([
        // Students list: Admin, Counter Person -> getAllStudents, Teacher -> getMyStudents
        isStaff
          ? (isTeacher ? studentService.getMyStudents() : studentService.getAllStudents()).catch(e => { console.error('Students error:', e); return []; })
          : Promise.resolve([]),
        // Classes/Users: Admin only
        isAdmin
          ? classService.getAllClasses().catch(e => { console.error('Classes error:', e); return []; })
          : Promise.resolve([]),
        // Parents: Admin or Counter Person
        isAdminOrCounterPerson
          ? request('/parents').catch(e => { console.error('Parents error:', e); return []; })
          : Promise.resolve([]),
        // Courses: All roles
        request('/courses').catch(e => { console.error('Courses error:', e); return []; }),
        // Teachers: Admin or Teacher
        isAdminOrTeacher
          ? request('/teachers').catch(e => { console.error('Teachers error:', e); return []; })
          : Promise.resolve([]),
        // Subjects: Admin or Teacher
        isAdminOrTeacher
          ? request('/subjects').catch(e => { console.error('Subjects error:', e); return []; })
          : Promise.resolve([]),
        // Halls: Admin, Teacher, Counter Person
        isAdminOrTeacherOrCounterPerson
          ? request('/halls').catch(e => { console.error('Halls error:', e); return []; })
          : Promise.resolve([]),
        // Revenue: Admin only
        isAdmin
          ? request('/reports/revenue').catch(e => { console.error('Revenue error:', e); return []; })
          : Promise.resolve([]),
        // Attendance stats: Admin, Teacher, or Counter Person
        isAdminOrTeacherOrCounterPerson
          ? request('/reports/attendance-stats').catch(e => { console.error('Attendance error:', e); return []; })
          : Promise.resolve([]),
        // Contact messages: Admin only
        isAdmin
          ? request('/contact/messages').catch(e => { console.error('Messages error:', e); return []; })
          : Promise.resolve([]),
        // Study area seats: All staff
        request('/study-area/seats').catch(e => { console.error('Seats error:', e); return []; }),
        // SMS/WhatsApp logs: Admin + Counter Person
        isAdminOrCounterPerson
          ? request('/sms/logs').catch(e => { console.error('SMS error:', e); return []; })
          : Promise.resolve([]),
        // Class schedules: Admin, Teacher, Counter Person
        isAdminOrTeacherOrCounterPerson
          ? request('/classes/schedules').catch(e => { console.error('Schedules error:', e); return []; })
          : Promise.resolve([]),
        // Promos: All
        request('/promos').catch(e => { console.error('Promos error:', e); return []; }),
        // Audit Logs: Admin
        isAdmin ? request('/audit/logs').catch(e => { console.error('Audit error:', e); return []; }) : Promise.resolve([]),
        // AI Health: Admin (timeout 8s to not block dashboard if AI server is busy)
        isAdmin ? withTimeout(request('/attendance/health-stats').catch(e => { console.error('Health error:', e); return {}; }), 8000, {}) : Promise.resolve({}),
        // Congestion: Admin
        isAdmin ? request('/reports/congestion-history').catch(e => { console.error('Congestion error:', e); return []; }) : Promise.resolve([]),
        // Hall Utilization: Admin
        isAdmin ? request('/reports/hall-utilization').catch(e => { console.error('Hall util error:', e); return []; }) : Promise.resolve([]),
        // Punctuality: Admin/Teacher
        isAdminOrTeacher ? request('/reports/punctuality').catch(e => { console.error('Punctuality error:', e); return []; }) : Promise.resolve([]),
        // Teacher Performance: Admin
        isAdmin ? request('/reports/teacher-performance').catch(e => { console.error('Teacher perf error:', e); return []; }) : Promise.resolve([])
      ]);

      setStudents(studentData || []);
      setClasses(classData || []);
      setParents(parentData || []);
      setRealCourses(courseData || []);
      setLecturers(lecturerData || []);
      setSubjects(subjectData || []);
      setHalls(hallData || []);
      setRevenueData(revData || []);
      setAttendanceStats(attData || []);
      setInquiries(msgData || []);
      setStudySeats(seatData || []);
      setSmsLogs(smsData || []);
      setClassSchedules(schedulesData || []);
      setPromotions(promoData || []);
      setAuditLogs(auditData || []);
      setAiHealthStats(healthData || {});
      setCongestionData(congestionInfo || []);
      setHallUtilData(hallUtilInfo || []);
      setPunctualityData(punctualityInfo || []);
      setTeacherPerfData(teacherPerfInfo || []);

      // Suspicious Logs (Admin only)
      if (isAdmin) {
        const suspData = await request('/attendance/suspicious-logs').catch(e => { console.error('Suspicious logs error:', e); return []; });
        setSuspiciousLogs(suspData || []);
      } else {
        setSuspiciousLogs([]);
      }

      // පද්ධති සැකසුම් (Admin Only)
      if (isAdmin) {
        const settings = await request('/settings').catch(e => {
          console.error('Settings error:', e);
          return [];
        });
        setSystemSettings(settings || []);
      } else {
        setSystemSettings([]);
      }

      // පෞද්ගලික කාලසටහන (Teacher only for staff - student handled above)
      if (isTeacher) {
        const timetableData = await request('/classes/my-timetable').catch(e => {
          console.error('Timetable error:', e);
          return [];
        });
        setMyTimetable(timetableData || []);
      } else {
        setMyTimetable([]);
      }

      // අනුමැතිය සඳහා සිටින සිසුන් (Admin and Counter Person only)
      if (isAdminOrCounterPerson) {
        const pendingData = await request('/students/pending').catch(e => {
          console.error('Pending students error:', e);
          return [];
        });
        setPendingStudents(pendingData || []);
      } else {
        setPendingStudents([]);
      }

      setEnrolledCourses([]);
    } catch (err) {
      console.error('Dashboard Fetch Error:', err);
      setError('දත්ත ලබා ගැනීමේදී දෝෂයක් සිදුවිය. කරුණාකර පසුව නැවත උත්සාහ කරන්න.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDatabaseData();
    }
  }, []); // Run once on mount only - tab changes don't need full re-fetch

  // 📱 WhatsApp Status Polling (every 10 seconds for Admin/Counter)
  useEffect(() => {
    if (!isAdminOrCounterPerson) return;
    const pollWhatsAppStatus = async () => {
      try {
        const status = await request('/sms/whatsapp-status').catch(() => null);
        if (status) setWhatsappStatus(status);
      } catch (e) { /* ignore */ }
    };
    pollWhatsAppStatus(); // initial check
    const interval = setInterval(pollWhatsAppStatus, 10000); // every 10s
    return () => clearInterval(interval);
  }, [isAdminOrCounterPerson]);

  // 🕒 Attendance Sync: Fetches current attendance status & enrolled students for the selected course in parallel
  useEffect(() => {
    if (selectedAttendanceCourse) {
      Promise.all([
        request(`/enrollments/course/${selectedAttendanceCourse}`).catch(() => []),
        request(`/attendance/logs/${selectedAttendanceCourse}`).catch(() => [])
      ])
        .then(([enrollments, logs]) => {
          // Format enrolled students list
          const formattedStudents = (enrollments || []).map(enr => ({
            _id: enr.student_id,
            studentId: enr.qr_code_key,
            name: enr.student_name,
            email: enr.school || 'N/A',
            parentName: enr.parent_name || 'N/A'
          }));
          setCourseEnrolledStudents(formattedStudents);

          // Map attendance check states
          const records = {};
          formattedStudents.forEach(student => {
            records[student._id] = false;
          });
          if (logs && Array.isArray(logs)) {
            logs.forEach(log => {
              records[log.student_id] = true;
            });
          }
          setAttendanceRecords(records);
        })
        .catch(err => {
          console.error('Error fetching attendance logs/enrollments:', err);
          showNotification('පැමිණීමේ දත්ත ලබා ගැනීම අසාර්ථකයි.', 'error');
        });
    } else {
      setCourseEnrolledStudents([]);
      setAttendanceRecords({});
    }
  }, [selectedAttendanceCourse]);

  if (!user) {
    return <Navigate to="/" />;
  }

  const handleOpenAddStudentModal = () => {
    let nextIdStr = 'ST001';
    if (students && students.length > 0) {
      let maxIdNum = 0;
      students.forEach(s => {
        if (s.studentId) {
          const numMatch = s.studentId.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            if (num > maxIdNum) maxIdNum = num;
          }
        }
      });
      const nextNum = maxIdNum + 1;
      nextIdStr = `ST${nextNum.toString().padStart(3, '0')}`;
    }
    setStudentId(nextIdStr);
    setShowAddModal(true);
  };

  // ශිෂ්‍යයින් සඳහා Modal Handler ටික
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await studentService.createStudent({
        username: studentId,
        password: 'Thusitha@123',
        student_name: name,
        school: schoolName,
        grade: studentGrade,
        qr_code_key: studentId,
        parent_id: selectedParent,
        parent_name: parentName,
        parent_phone: parentPhone,
        address: address
      });
      setShowAddModal(false);
      setStudentId('');
      setName('');
      setSchoolName('');
      setStudentGrade('');
      setParentName('');
      setParentPhone('');
      setAddress('');
      setSelectedParent('');
      fetchDatabaseData();
      showNotification('ශිෂ්‍යයා සාර්ථකව ඇතුළත් කළා!');
    } catch (err) {
      console.error('Add Student Error:', err);
      showNotification(err.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ශිෂ්‍යයෙක් සංස්කරණය කිරීමේ Handler එක
  const handleEditStudent = async (id, studentData) => {
    try {
      await studentService.updateStudent(id, studentData);
      showNotification('ශිෂ්‍ය දත්ත සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      console.error('Edit Student Error:', err);
      showNotification(err.message, 'error');
      throw err;
    }
  };

  // ශිෂ්‍යයෙක් ඉවත් කිරීමේ Handler එක
  const handleDeleteStudent = async (id) => {
    try {
      await studentService.deleteStudent(id);
      showNotification('ශිෂ්‍යයා පද්ධතියෙන් ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      console.error('Delete Student Error:', err);
      showNotification(err.message, 'error');
      throw err;
    }
  };

  // ගුරුවරයෙක් එකතු කිරීමේ Handler එක
  const handleAddTeacher = async (teacherData) => {
    try {
      await request('/teachers/register', {
        method: 'POST',
        body: teacherData,
        isFormData: true
      });
      showNotification('ගුරුවරයා සාර්ථකව ඇතුළත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      console.error('Add Teacher Error:', err);
      showNotification(err.message, 'error');
      throw err;
    }
  };

  // ගුරුවරයෙක් සංස්කරණය කිරීමේ Handler එක
  const handleEditTeacher = async (id, teacherData) => {
    try {
      await request(`/teachers/${id}`, {
        method: 'PUT',
        body: teacherData,
        isFormData: true
      });
      showNotification('ගුරු දත්ත සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      console.error('Edit Teacher Error:', err);
      showNotification(err.message, 'error');
      throw err;
    }
  };

  // ගුරුවරයෙක් ඉවත් කිරීමේ Handler එක
  const handleDeleteTeacher = async (id) => {
    try {
      await request(`/teachers/${id}`, {
        method: 'DELETE'
      });
      showNotification('ගුරුවරයා පද්ධතියෙන් ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      console.error('Delete Teacher Error:', err);
      showNotification(err.message, 'error');
      throw err;
    }
  };

  // 🆔 Student ID Card Generator Logic
  const handleDownloadIDCard = async (student) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 55] }); // Standard CR80 size
      const qrDataUrl = await QRCode.toDataURL(String(student.studentId));

      // Background & Style
      doc.setFillColor(26, 35, 126); // Thusitha Navy Blue
      doc.rect(0, 0, 85, 15, 'F');

      doc.setFontSize(12);
      doc.setTextColor(255);
      doc.text('THUSITHA SMART CLASS', 42.5, 10, { align: 'center' });

      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.text(`Name: ${student.name}`, 5, 25);
      doc.text(`ID: ${student.studentId}`, 5, 32);
      doc.text(`School: ${student.email || 'N/A'}`, 5, 39);

      // Add QR Code
      doc.addImage(qrDataUrl, 'PNG', 55, 20, 25, 25);

      doc.save(`ID_Card_${student.studentId}.pdf`);
      showNotification('ID පත සාර්ථකව නිර්මාණය කළා!');
    } catch (err) {
      console.error('ID Card generation error:', err);
      showNotification('ID පත සැකසීම අසාර්ථකයි.', 'error');
    }
  };

  // --- Class Management Handlers ---

  const handleCreateCourse = async (courseData) => {
    try {
      await request('/courses', { method: 'POST', body: courseData });
      showNotification('පන්තිය සාර්ථකව එකතු කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleUpdateCourse = async (id, courseData) => {
    try {
      await request(`/courses/${id}`, { method: 'PUT', body: courseData });
      showNotification('පන්තිය සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteCourse = async (id) => {
    try {
      await request(`/courses/${id}`, { method: 'DELETE' });
      showNotification('පන්තිය ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleCreateSubject = async (subjectData) => {
    try {
      await request('/subjects', { method: 'POST', body: subjectData });
      showNotification('විෂය සාර්ථකව එකතු කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteSubject = async (id) => {
    try {
      await request(`/subjects/${id}`, { method: 'DELETE' });
      showNotification('විෂය ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleCreateHall = async (hallData) => {
    try {
      await request('/halls', { method: 'POST', body: hallData });
      showNotification('ශාලාව සාර්ථකව එකතු කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteHall = async (id) => {
    try {
      await request(`/halls/${id}`, { method: 'DELETE' });
      showNotification('ශාලාව ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleUpdateSubject = async (id, subjectData) => {
    try {
      await request(`/subjects/${id}`, { method: 'PUT', body: subjectData });
      showNotification('විෂය සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleUpdateHall = async (id, hallData) => {
    try {
      await request(`/halls/${id}`, { method: 'PUT', body: hallData });
      showNotification('ශාලාව සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // ---------------------------------

  const handleCreatePromo = async (formData) => {
    try {
      await request('/promos', { method: 'POST', body: formData, isFormData: true });
      fetchDatabaseData();
      showNotification('ප්‍රවර්ධන දත්ත සාර්ථකව උඩුගත කළා!');
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const handleUpdatePromo = async (id, formData) => {
    try {
      await request(`/promos/${id}`, { method: 'PUT', body: formData, isFormData: true });
      fetchDatabaseData();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const handleDeletePromo = async (id) => {
    try {
      await request(`/promos/${id}`, { method: 'DELETE' });
      fetchDatabaseData();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  // නව සැකසුමක් (Template) එකතු කිරීමේ Handler එක
  const handleCreateSetting = async (settingData) => {
    try {
      await request('/settings/create', {
        method: 'POST',
        body: settingData
      });
      showNotification('නව සැකසුම සාර්ථකව එක් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // සැකසුමක් ඉවත් කිරීමේ Handler එක
  const handleDeleteSetting = async (key) => {
    if (!globalThis.confirm('මෙම සැකසුම ඉවත් කිරීම ස්ථිරද?')) return;
    try {
      await request(`/settings/delete/${key}`, {
        method: 'DELETE'
      });
      showNotification('සැකසුම සාර්ථකව ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පණිවිඩයක් වැදගත් ලෙස සලකුණු කිරීමේ Handler එක
  const handleToggleImportant = async (id) => {
    try {
      await request(`/contact/important/${id}`, { method: 'PATCH' });
      fetchDatabaseData();
    } catch (err) {
      console.error('Error toggling importance:', err);
      showNotification(err.message, 'error');
    }
  };

  // Quick Reply SMS Handler
  const handleQuickReply = async (message, text) => {
    if (!message.sender_phone) return showNotification('මෙම විමසීමේ දුරකථන අංකයක් නොමැත.', 'error');
    try {
      await request('/sms/send-custom', {
        method: 'POST',
        body: { phone: message.sender_phone, message: text }
      });
      showNotification('Quick Reply SMS එක සාර්ථකව යවන ලදී!');
      handleMarkRead(message.message_id); // Auto mark as read
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // සියලුම පණිවිඩ කියවූ බව සටහන් කිරීමේ Handler එක
  const handleMarkAllRead = async () => {
    try {
      await request('/contact/mark-all-read', { method: 'PATCH' });
      showNotification('සියලුම පණිවිඩ කියවූ බව සටහන් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // ශිෂ්‍ය අනුමැතිය ලබා දීමේ Handler එක
  const handleApproveStudent = async (pendingId, qrKey) => {
    try {
      await request('/students/approve', {
        method: 'POST',
        body: { pending_id: pendingId, qr_code_key: qrKey }
      });
      showNotification('ශිෂ්‍යයා සාර්ථකව අනුමත කර ගිණුම සක්‍රිය කළා!');
      fetchDatabaseData(); // Refresh all lists
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පන්ති ලියාපදිංචි කිරීමේ Handler එක
  const handleEnroll = async (enrollData) => {
    try {
      const res = await request('/enrollments/enroll', {
        method: 'POST',
        body: enrollData
      });
      if (res.warning) {
        showNotification(res.message, 'warning'); // Show warning (orange/yellow toast usually)
      } else {
        showNotification(res.message || 'ශිෂ්‍යයා පන්තියට සාර්ථකව ඇතුළත් කළා!');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පණිවිඩයක් කියවූ බව සටහන් කිරීමේ Handler එක
  const handleMarkRead = async (id) => {
    try {
      await request(`/contact/read/${id}`, { method: 'PATCH' });
      fetchDatabaseData();
      showNotification('පණිවිඩය කියවූ බව සටහන් කළා!');
    } catch (err) {
      console.error('Error marking message as read:', err);
      showNotification(err.message, 'error');
    }
  };

  // පණිවිඩයක් Spam ලෙස සටහන් කිරීමේ Handler එක
  const handleMarkSpam = async (id) => {
    try {
      await request(`/contact/spam/${id}`, { method: 'PATCH' });
      fetchDatabaseData();
      showNotification('පණිවිඩය Spam ලෙස සටහන් කළා!');
    } catch (err) {
      console.error('Error marking message as spam:', err);
      showNotification(err.message, 'error');
    }
  };

  // පණිවිඩයක් Spam වලින් ඉවත් කිරීමේ Handler එක
  const handleRecoverFromSpam = async (id) => {
    try {
      await request(`/contact/recover/${id}`, { method: 'PATCH' });
      fetchDatabaseData();
      showNotification('පණිවිඩය Spam වලින් සාර්ථකව ඉවත් කළා!');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // විභාගයක් ඇතුළත් කිරීමේ Handler එක
  const handleCreateExam = async (examData) => {
    try {
      await request('/exams', {
        method: 'POST',
        body: examData
      });
      showNotification('විභාගය සාර්ථකව ඇතුළත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // සියලුම සිසුන් Encode කිරීමේ Handler එක
  const handleBulkEncode = async () => {
    try {
      const response = await request('/students/bulk-encode', { method: 'POST' });
      showNotification(response.message);
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පැමිණීමේ විසංවාදයක් පිළිබඳ මව්පියන්ට දැනුම් දීමේ Handler එක
  const handleSendDiscrepancySMS = async (studentId, sessionId) => {
    try {
      await request('/attendance/discrepancy-alert', {
        method: 'POST',
        body: { student_id: studentId, session_id: sessionId }
      });
      showNotification('මව්පියන්ට දැනුම් දීමේ SMS පණිවිඩය සාර්ථකව යවන ලදී.');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පෙරාගත් සියලුම සිසුන්ගේ මව්පියන්ට දැනුම් දීමේ Handler එක (Bulk)
  const handleBulkDiscrepancyAlert = async (studentIds, sessionId) => {
    try {
      const response = await request('/attendance/bulk-discrepancy-alert', {
        method: 'POST',
        body: { student_ids: studentIds, session_id: sessionId }
      });
      showNotification(response.message);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Safety Drill ආරම්භ කිරීමේ Handler එක
  const handleTriggerSafetyDrill = async () => {
    if (!globalThis.confirm('Safety Drill එකක් ආරම්භ කිරීමට ඔබ වග බලා ගන්න. සියලුම කාර්ය මණ්ඩලයට SMS යවනු ලැබේ.')) return;
    try {
      const response = await request('/attendance/safety-drill', { method: 'POST' });
      showNotification(response.message);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // මුහුණේ දත්ත ගණනය කිරීමේ Handler එක (Optimization)
  const handleGenerateEncoding = async (studentId) => {
    try {
      await request(`/students/encode/${studentId}`, { method: 'POST' });
      showNotification('ශිෂ්‍යයාගේ මුහුණේ දත්ත සාර්ථකව ගණනය කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // 🛡️ Upload student profile photo
  const handleUploadPhoto = async (studentId, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await studentService.uploadStudentPhoto(studentId, formData);
      showNotification('ඡායාරූපය සාර්ථකව උඩුගත කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // සැකසුමක් යාවත්කාලීන කිරීමේ Handler එක
  const handleUpdateSetting = async (key, value) => {
    try {
      await request('/settings/update', {
        method: 'POST',
        body: { key, value }
      });
      showNotification('සැකසුම සාර්ථකව සුරැකුණි!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // නව පන්ති කාලසටහනක් නිර්මාණය කිරීමේ Handler එක
  const handleCreateClass = async (classData) => {
    try {
      await request('/classes/schedule', {
        method: 'POST',
        body: classData
      });
      showNotification('පන්ති කාලසටහන සාර්ථකව සුරැකුණි!');
      fetchDatabaseData(); // Refresh schedules
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පන්ති කාලසටහනක් යාවත්කාලීන කිරීමේ Handler එක
  const handleUpdateClass = async (id, classData) => {
    try {
      await request(`/classes/schedule/${id}`, {
        method: 'PUT',
        body: classData
      });
      showNotification('පන්ති කාලසටහන සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පන්ති කාලසටහනක් ඉවත් කිරීමේ Handler එක
  const handleDeleteClass = async (id) => {
    try {
      await request(`/classes/schedule/${id}`, { method: 'DELETE' });
      showNotification('පන්ති කාලසටහන සාර්ථකව ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
      throw err;
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      await request(`/users/reset-password/${userId}`, { method: 'POST' });
      showNotification('Password reset request sent successfully.');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      await request('/users', {
        method: 'POST',
        body: userData
      });
      showNotification('නව පරිශීලකයා සාර්ථකව ඇතුළත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await request(`/users/${id}`, { method: 'DELETE' });
      showNotification('පරිශීලකයා සාර්ථකව ඉවත් කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
      throw err;
    }
  };

  const handleCheckOutSeat = async (bookingId, seatId) => {
    try {
      await request(`/study-area/check-out/${bookingId}`, {
        method: 'POST',
        body: { seat_id: seatId }
      });
      showNotification('අසුනින් පිටවීම සාර්ථකයි!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // අසුනකට පැමිණීම සටහන් කිරීම (Check-in)
  const handleCheckInSeat = async (bookingId) => {
    try {
      await request(`/study-area/check-in/${bookingId}`, {
        method: 'PATCH'
      });
      showNotification('පැමිණීම සාර්ථකව සටහන් කළා! පැය 4ක කාලය ආරම්භ විය.');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // අසුන් වෙන් කිරීමේ Handler එක
  const handleBookSeat = async (bookingData) => {
    try {
      await request('/study-area/book', {
        method: 'POST',
        body: bookingData
      });
      showNotification('අසුන සාර්ථකව වෙන් කළා!');
      fetchDatabaseData(); // Refresh seat availability
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // හිඟ මුදල් මතක් කිරීමේ Handler එක
  const handleSendReminders = async (reminderData) => {
    try {
      const response = await request('/payments/remind', {
        method: 'POST',
        body: reminderData
      });
      showNotification(response.message);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // ගෙවීම් සටහන් කිරීමේ Handler එක
  const handleRecordPayment = async (paymentData) => {
    try {
      await request('/payments', {
        method: 'POST',
        body: paymentData
      });
      showNotification('ගෙවීම සාර්ථකව සුරැකුණි!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // විභාගයක් යාවත්කාලීන කිරීමේ Handler එක
  const handleUpdateExam = async (id, examData) => {
    try {
      await request(`/exams/${id}`, {
        method: 'PUT',
        body: examData
      });
      showNotification('විභාගය සාර්ථකව යාවත්කාලීන කළා!');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // විභාගයක් ඉවත් කිරීමේ Handler එක
  const handleDeleteExam = async (id) => {
    try {
      await request(`/exams/${id}`, { method: 'DELETE' });
      showNotification('විභාගය පද්ධතියෙන් ඉවත් කළා!');
    } catch (err) {
      showNotification(err.message, 'error');
      throw err;
    }
  };

  // SMS පණිවිඩයක් නැවත යැවීමේ Handler එක
  const handleResendSMS = async (logId) => {
    try {
      await request(`/sms/resend/${logId}`, { method: 'POST' });
      showNotification('පණිවිඩය සාර්ථකව නැවත යවන ලදී!');
      fetchDatabaseData(); // වාර්තා නැවත පූරණය කිරීම
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // WhatsApp Delete Log (API call)
  const handleDeleteSMSLog = async (id) => {
    try {
      await request(`/sms/logs/${id}`, { method: 'DELETE' });
      setSmsLogs(prev => prev.filter(log => log.log_id !== id));
    } catch (err) {
      // Fallback: remove from UI
      setSmsLogs(prev => prev.filter(log => log.log_id !== id));
    }
  };

  // WhatsApp Bulk Send Reminder
  const handleSendWhatsAppReminder = async (payload) => {
    const res = await request('/sms/send-reminder', { method: 'POST', body: payload });
    return res;
  };

  // පණිවිඩ තොග වශයෙන් නැවත යැවීම (Bulk Resend)
  const handleBulkResendSMS = async (date) => {
    if (!date) return showNotification('කරුණාකර දිනයක් තෝරන්න.', 'error');
    try {
      await request('/sms/bulk-resend', {
        method: 'POST',
        body: { date }
      });
      showNotification('තෝරාගත් දිනට අදාළ පණිවිඩ නැවත යැවීම ආරම්භ කරන ලදී.');
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // පෙරාගත් අසාර්ථක පණිවිඩ සියල්ල නැවත යැවීම
  const handleResendFilteredFailed = async (ids) => {
    try {
      await request('/sms/bulk-resend-ids', {
        method: 'POST',
        body: { ids }
      });
      showNotification(`${ids.length} පණිවිඩ නැවත යැවීම ආරම්භ කරන ලදී.`);
      fetchDatabaseData();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // සැකසහිත ක්‍රියාකාරකම් ලොගයක් නිරාකරණය කිරීමේ Handler
  const handleResolveSuspiciousLog = async (logId, comment) => {
    try {
      await request(`/attendance/resolve-log/${logId}`, {
        method: 'PATCH',
        body: { resolution_comment: comment }
      });
      showNotification('ලොගය සාර්ථකව නිරාකරණය කළා!');
      const suspData = await request('/attendance/suspicious-logs').catch(() => []);
      setSuspiciousLogs(suspData || []);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleCheckboxChange = (id) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleBulkCheckboxChange = (isChecked) => {
    const filteredStudents = getFilteredStudents();
    const newRecords = { ...attendanceRecords };
    filteredStudents.forEach(student => {
      const studentKey = student._id || student.studentId;
      newRecords[studentKey] = isChecked;
    });
    setAttendanceRecords(newRecords);
  };

  //Filtering students based on enrollment
  const getFilteredStudents = () => {
    if (!selectedAttendanceCourse) return [];
    return courseEnrolledStudents;
  };

  // පැමිණීම ඩේටාබේස් එකට යැවීම
  const handleSaveAttendance = async () => {
    if (!selectedAttendanceCourse) {
      showNotification('කරුණාකර පන්තියක් (Class) තෝරන්න.', 'warning');
      return;
    }
    setAttendanceLoading(true);
    try {
      const records = Object.keys(attendanceRecords).map(id => ({
        student: id,
        status: attendanceRecords[id] ? 'Present' : 'Absent'
      }));

      await attendanceService.saveAttendance({
        date: new Date().toISOString().split('T')[0],
        course_id: selectedAttendanceCourse,
        records: records
      });
      showNotification('අද දින පැමිණීම සාර්ථකව සුරැකුණි!');
    } catch (err) {
      console.error('Save Attendance Error:', err);
      showNotification(err.message, 'error');
    } finally {
      setAttendanceLoading(false);
    }
  };



  const handleLogout = () => {
    localStorage.removeItem('token'); // Remove token from localStorage
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans relative selection:bg-secondary-light selection:text-white">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        role={user.role}
      />

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-y-auto relative z-10 custom-scrollbar">
        {/* Dynamic Topbar with Glassmorphism */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="sticky top-0 z-30 h-20 bg-white/60 backdrop-blur-xl border-b border-white/50 flex items-center justify-between px-10 shadow-glass"
        >
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark to-secondary-dark flex items-center gap-3 text-2xl tracking-tight">
            {activeTab === 'home' && '📊 Dashboard Overview'}
            {activeTab === 'students' && '🧑‍🎓 Student Management'}
            {activeTab === 'classes' && '📚 Class & User Management'}
            {activeTab === 'attendance' && '📝 Attendance Management'}
            {activeTab === 'study_area' && '📖 Study Area Booking'}
            {activeTab === 'exams' && '📝 Exams & Results'}
            {activeTab === 'payments' && '💰 Payment Management'}
            {activeTab === 'approvals' && '⏳ Student Approvals'}
            {activeTab === 'ai_panel' && '🎥 AI නිරීක්ෂණය සහ පරීක්ෂාව'}
          </span>
          <div className="flex items-center gap-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-sm text-gray-700 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-glass border border-white/50 font-semibold flex items-center gap-2"
            >
              පරිශීලක: <span className="text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-md">{user.username}</span>
            </motion.div>
          </div>
        </motion.div>

        <div className="p-10 flex-1 w-full max-w-7xl mx-auto relative z-0">
          {error && (
            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="text-rose-700 bg-rose-50/80 backdrop-blur-md p-5 rounded-2xl mb-8 shadow-glass border border-rose-200 flex items-center gap-3 font-bold text-lg">
              ⚠️ {error}
            </motion.div>
          )}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 text-primary-dark font-extrabold text-xl animate-pulse bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-glass border border-white/50 w-max mb-8">
              <span className="loader"></span> දත්ත පූරණය වෙමින් පවතී...
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
              transition={{ type: 'spring', stiffness: 250, damping: 25 }}
              className="w-full"
            >

              {/* HOME TAB */}
              {!loading && activeTab === 'home' && (() => {
                const currentTeacher = isTeacher ? lecturers.find(t => t.user_id === user.id) : null;
                
                const teacherPhotoMap = {
                    'ruwan': '/teachers/ruwan.png',
                    'sunil': '/teachers/sunil.png',
                    'sumeera': '/teachers/sumeera.png',
                    'sampath': '/teachers/sampath.png',
                    'nimali': '/teachers/nimali.png',
                    'namal': '/teachers/namal.png',
                    'shanika': '/teachers/shanika.png',
                    'thusitha': '/teachers/thusitha.png'
                };
                
                let resolvedPhoto = null;
                if (currentTeacher?.teacher_name) {
                    const nameKey = currentTeacher.teacher_name.toLowerCase();
                    for (const [key, path] of Object.entries(teacherPhotoMap)) {
                        if (nameKey.includes(key) || user?.username?.toLowerCase().includes(key)) {
                            resolvedPhoto = path;
                            break;
                        }
                    }
                }
                if (!resolvedPhoto && user?.username && teacherPhotoMap[user.username.toLowerCase()]) {
                    resolvedPhoto = teacherPhotoMap[user.username.toLowerCase()];
                }
                const profilePhotoPath = isStudent
                  ? (myProfilePhoto || null)
                  : (resolvedPhoto || currentTeacher?.profile_photo_path || null);

                let displayUserCount = classes.length;

                if (isTeacher && currentTeacher) {
                   const myCourses = realCourses.filter(c => c.teacher_id === currentTeacher.teacher_id);
                   displayUserCount = myCourses.length;
                }

                return (
                  <HomeTab
                    username={user.username}
                    role={user.role}
                    studentCount={students.length}
                    userCount={displayUserCount}
                    enrolledCourses={enrolledCourses}
                    revenueData={revenueData}
                    attendanceData={attendanceStats}
                    profilePhotoPath={profilePhotoPath}
                  />
                );
              })()}

              {/* STUDENTS TAB */}
              {!loading && activeTab === 'students' && (
                <>
                  {isAdminOrCounterPerson && (
                    <div className="flex justify-end mb-5">
                      <Button variant="outline" size="sm" icon={<Settings2 size={16} />} onClick={handleBulkEncode}>
                        සියලුම සිසුන් Encode කරන්න (Bulk Encode)
                      </Button>
                    </div>
                  )}
                  <StudentTab students={students} courses={realCourses} onAddClick={handleOpenAddStudentModal} onEditClick={handleEditStudent} onDeleteClick={handleDeleteStudent} onEncode={handleGenerateEncoding} onUploadPhoto={handleUploadPhoto} onDownloadIDCard={handleDownloadIDCard} role={user.role} />
                </>
              )}

              {/* TEACHERS TAB */}
              {!loading && activeTab === 'teachers' && isAdmin && (
                <TeacherTab
                  teachers={lecturers}
                  onAdd={handleAddTeacher}
                  onEdit={handleEditTeacher}
                  onDelete={handleDeleteTeacher}
                />
              )}

              {/* APPROVALS TAB */}
              {!loading && activeTab === 'approvals' && (
                <ApprovalTab pendingStudents={pendingStudents} onApprove={handleApproveStudent} />
              )}

              {/* CLASS MANAGEMENT TAB */}
              {activeTab === 'class_management' && (
                <div style={{ display: loading ? 'none' : 'block' }}>
                  <ClassTab
                    courses={realCourses}
                    lecturers={lecturers}
                    subjects={subjects}
                    halls={halls}
                    classSchedules={classSchedules}
                    onCreateClass={handleCreateClass}
                    onUpdateClass={handleUpdateClass}
                    onDeleteClass={handleDeleteClass}
                    onCreateCourse={handleCreateCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onDeleteCourse={handleDeleteCourse}
                    onCreateSubject={handleCreateSubject}
                    onUpdateSubject={handleUpdateSubject}
                    onDeleteSubject={handleDeleteSubject}
                    onCreateHall={handleCreateHall}
                    onUpdateHall={handleUpdateHall}
                    onDeleteHall={handleDeleteHall}
                  />
                </div>
              )}
              {/* CLASSES TAB */}
              {!loading && activeTab === 'classes' && (
                <UserTab
                  users={classes}
                  onResetPassword={handleResetPassword}
                  onCreateUser={handleCreateUser}
                  onDeleteUser={handleDeleteUser}
                />
              )}

              {/* ATTENDANCE TAB */}
              {activeTab === 'attendance' && (
                <div style={{ display: loading ? 'none' : 'block' }}>
                  <AttendanceTab
                    students={getFilteredStudents()}
                    courses={realCourses}
                    selectedCourse={selectedAttendanceCourse}
                    onCourseChange={setSelectedAttendanceCourse}
                    attendanceRecords={attendanceRecords}
                    onCheckboxChange={handleCheckboxChange}
                    onBulkCheckboxChange={handleBulkCheckboxChange}
                    onSave={handleSaveAttendance}
                    loading={attendanceLoading}
                  />
                </div>
              )}

              {/* ENROLLMENT TAB */}
              {!loading && activeTab === 'enrollment' && (
                <EnrollmentTab students={students} courses={realCourses} onEnroll={handleEnroll} />
              )}

              {/* QR ATTENDANCE TAB — Admin & Counter Person only */}
              {!loading && activeTab === 'qr_attendance' && isAdminOrCounterPerson && (
                <QRAttendanceTab courses={realCourses} />
              )}

              {/* STUDY AREA TAB */}
              {activeTab === 'study_area' && (
                <div style={{ display: loading ? 'none' : 'block' }}>
                  <StudyAreaTab
                    students={students}
                    seats={studySeats}
                    onBook={handleBookSeat}
                    onCheckIn={handleCheckInSeat}
                    onCheckOut={handleCheckOutSeat}
                    currentUser={isStudent ? user : null}
                  />
                </div>
              )}

              {/* PARENT PORTAL TAB */}
              {activeTab === 'parent_portal' && (
                <div style={{ display: loading ? 'none' : 'block' }}>
                  <ParentPortalTab
                    myChildren={myChildren}
                    onRefresh={fetchDatabaseData}
                  />
                </div>
              )}

              {/* EXAMS TAB */}
              {activeTab === 'exams' && (
                <div style={{ display: loading ? 'none' : 'block' }}>
                  <ExamTab
                    courses={isStudent ? enrolledCourses : realCourses}
                    role={user.role}
                    onCreateExam={handleCreateExam}
                    onUpdateExam={handleUpdateExam}
                    onDeleteExam={handleDeleteExam}
                  />
                </div>
              )}

              {/* ADMIN HUB TAB (Inquiries + WhatsApp + Settings) */}
              {!loading && activeTab === 'admin_hub' && (
                <AdminHubTab
                  inquiries={inquiries}
                  onMarkRead={handleMarkRead}
                  onMarkSpam={handleMarkSpam}
                  onRecoverFromSpam={handleRecoverFromSpam}
                  onMarkAllRead={handleMarkAllRead}
                  onToggleImportant={handleToggleImportant}
                  onQuickReply={handleQuickReply}
                  smsLogs={smsLogs}
                  onResendSMS={handleResendSMS}
                  onDeleteSMSLog={handleDeleteSMSLog}
                  onBulkResendSMS={handleBulkResendSMS}
                  onResendFilteredFailed={handleResendFilteredFailed}
                  students={students}
                  courses={realCourses}
                  onSendReminder={handleSendWhatsAppReminder}
                  whatsappStatus={whatsappStatus}
                  systemSettings={systemSettings}
                  onUpdateSetting={handleUpdateSetting}
                  onCreateSetting={handleCreateSetting}
                  onDeleteSetting={handleDeleteSetting}
                  onTriggerDrill={handleTriggerSafetyDrill}
                />
              )}

              {/* MATERIALS TAB */}
              {!loading && activeTab === 'materials' && (
                <MaterialTab courses={user.role === 'Student' ? enrolledCourses : realCourses} />
              )}

              {/* PAYMENTS TAB */}
              {activeTab === 'payments' && (
                <div style={{ display: loading ? 'none' : 'block' }}>
                  {isStudent ? (
                    <StudentPaymentTab courses={enrolledCourses} />
                  ) : (
                    <PaymentTab
                      students={students}
                      courses={realCourses}
                      onRecordPayment={handleRecordPayment}
                      onSendReminders={handleSendReminders}
                      role={user.role}
                    />
                  )}
                </div>
              )}

              {/* AI PANEL (MERGED LIVE PANEL & VALIDATION) */}
              {!loading && activeTab === 'ai_panel' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <SmartAttendanceLivePanel
                    halls={halls}
                    activeSessions={classSchedules}
                  />
                </div>
              )}

              {/* FACE VERIFICATION TAB */}
              {!loading && activeTab === 'face_verification' && isAdminOrCounterPerson && (
                <FaceVerificationTab
                  activeSessions={classSchedules}
                  students={students}
                />
              )}

              {/* MY TIMETABLE TAB */}
              {!loading && activeTab === 'my_timetable' && (
                <TimetableTab schedules={myTimetable} role={user.role} />
              )}

              {/* PROMOTIONS TAB */}
              {!loading && activeTab === 'promos' && (
                <PromotionTab promos={promotions} onCreate={handleCreatePromo} onUpdate={handleUpdatePromo} onDelete={handleDeletePromo} />
              )}

              {/* ANNOUNCEMENTS TAB */}
              {!loading && activeTab === 'announcements' && (
                <AnnouncementTab />
              )}

              {/* ACHIEVEMENTS TAB */}
              {!loading && activeTab === 'achievements' && (
                <AchievementTab students={students} />
              )}

              {/* AUDIT LOGS TAB */}
              {!loading && activeTab === 'audit_logs' && (
                <AuditLogTab logs={auditLogs} />
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ADD STUDENT MODAL */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="අලුත් ශිෂ්‍යයෙක් ඇතුළත් කිරීම" maxWidth="max-w-md">
        <form onSubmit={handleAddStudent}>
          <div className="mb-4">
            <Label htmlFor="modal-student-id">ශිෂ්‍ය අංකය (Student ID / Username)</Label>
            <Input id="modal-student-id" type="text" placeholder="ST001" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
            <small className="text-slate-400 text-[11px] block mt-1.5">මෙය Login Username ලෙසත් QR Code Key ලෙසත් භාවිතා වේ. Default Password: Thusitha@123</small>
          </div>
          <div className="mb-4">
            <Label htmlFor="modal-student-name">ශිෂ්‍යයාගේ නම</Label>
            <Input id="modal-student-name" type="text" placeholder="Dilini Kawshalya" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mb-4">
            <Label htmlFor="modal-student-school">පාසල</Label>
            <Input id="modal-student-school" type="text" placeholder="Ananda College, Colombo" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
          <div className="mb-4">
            <Label htmlFor="modal-student-grade">ශ්‍රේණිය</Label>
            <Input id="modal-student-grade" type="text" placeholder="Grade 12" value={studentGrade} onChange={(e) => setStudentGrade(e.target.value)} />
          </div>
          <div className="mb-4">
            <Label htmlFor="modal-parent-name">මව්පියන්ගේ නම</Label>
            <Input id="modal-parent-name" type="text" placeholder="Parent Name" value={parentName} onChange={(e) => setParentName(e.target.value)} />
          </div>
          <div className="mb-4">
            <Label htmlFor="modal-parent-phone">මව්පියන්ගේ දුරකථන අංකය</Label>
            <Input id="modal-parent-phone" type="text" placeholder="0712345678" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
          </div>
          <div className="mb-6">
            <Label htmlFor="modal-student-address">ලිපිනය</Label>
            <Input id="modal-student-address" type="text" placeholder="129/14 Temple road, Colombo" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>අවලංගු කරන්න</Button>
            <Button type="submit" variant="primary" loading={submitLoading} icon={<UserPlus size={16} />}>
              {submitLoading ? 'සුරකිමින්...' : 'සුරකින්න'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
