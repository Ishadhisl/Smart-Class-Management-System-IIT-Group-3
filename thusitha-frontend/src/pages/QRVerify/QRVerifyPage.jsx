import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Bell, Clock, XCircle, Ban, WifiOff, Lock } from 'lucide-react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { request } from '../../services/api';

// ── State constants ───────────────────────────────────────────────────────────
const STATES = {
  LOADING:         'LOADING',
  SUCCESS:         'SUCCESS',
  ALREADY_MARKED:  'ALREADY_MARKED',
  QR_EXPIRED:      'QR_EXPIRED',
  QR_INVALID:      'QR_INVALID',
  SESSION_INACTIVE:'SESSION_INACTIVE',
  NOT_ENROLLED:    'NOT_ENROLLED',
  NETWORK_ERROR:   'NETWORK_ERROR',
  FORBIDDEN:       'FORBIDDEN',
};

// ── Result UI configurations ──────────────────────────────────────────────────
const RESULT_CONFIG = {
  SUCCESS: {
    icon: CheckCircle,
    title: 'පැමිණීම සාර්ථකව සටහන් විය!',
    titleEn: 'Attendance Marked Successfully',
    bgFrom: 'from-green-50', bgTo: 'to-emerald-100',
    borderColor: 'border-green-300',
    titleColor: 'text-green-800',
  },
  ALREADY_MARKED: {
    icon: Bell,
    title: 'පැමිණීම දැනටමත් සටහන් කර ඇත.',
    titleEn: 'Attendance Already Marked',
    bgFrom: 'from-blue-50', bgTo: 'to-indigo-100',
    borderColor: 'border-blue-300',
    titleColor: 'text-blue-800',
  },
  QR_EXPIRED: {
    icon: Clock,
    title: 'QR Code කාලය ඉකුත් වී ඇත.',
    titleEn: 'QR Code Expired',
    bgFrom: 'from-amber-50', bgTo: 'to-orange-100',
    borderColor: 'border-amber-300',
    titleColor: 'text-amber-800',
  },
  QR_INVALID: {
    icon: XCircle,
    title: 'QR Code වලංගු නොවේ.',
    titleEn: 'Invalid QR Code',
    bgFrom: 'from-red-50', bgTo: 'to-rose-100',
    borderColor: 'border-red-300',
    titleColor: 'text-red-800',
  },
  SESSION_INACTIVE: {
    icon: '',
    title: 'QR Attendance සැසිය වසා ඇත.',
    titleEn: 'Attendance Session Closed',
    bgFrom: 'from-gray-50', bgTo: 'to-slate-100',
    borderColor: 'border-gray-300',
    titleColor: 'text-gray-700',
  },
  NOT_ENROLLED: {
    icon: Ban,
    title: 'ඔබ මෙම පන්තියට ලියාපදිංචි නොවේ.',
    titleEn: 'Not Enrolled in This Class',
    bgFrom: 'from-yellow-50', bgTo: 'to-amber-100',
    borderColor: 'border-yellow-300',
    titleColor: 'text-yellow-800',
  },
  NETWORK_ERROR: {
    icon: WifiOff,
    title: 'සම්බන්ධතාව ව්‍යර්ථ විය.',
    titleEn: 'Connection Error',
    bgFrom: 'from-gray-50', bgTo: 'to-slate-100',
    borderColor: 'border-gray-300',
    titleColor: 'text-gray-700',
  },
  FORBIDDEN: {
    icon: Lock,
    title: 'ශිෂ්‍ය ගිණුමකින් login කරන්න.',
    titleEn: 'Student Login Required',
    bgFrom: 'from-purple-50', bgTo: 'to-indigo-100',
    borderColor: 'border-purple-300',
    titleColor: 'text-purple-800',
  },
};

// ── QR Verify Page ────────────────────────────────────────────────────────────
const QRVerifyPage = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const qrToken = searchParams.get('token');
  const [uiState, setUiState]       = useState(STATES.LOADING);
  const [attendance, setAttendance] = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const hasAttempted = useRef(false);

  const isAuthenticated = () => !!sessionStorage.getItem('token');

  // ── Handle redirect if not logged in ─────────────────────────────────────────
  const redirectToLogin = () => {
    // Store intended return path safely (only internal paths)
    const returnPath = `${location.pathname}${location.search}`;
    // Safety: only store relative paths
    if (returnPath.startsWith('/')) {
      sessionStorage.setItem('qr_return_path', returnPath);
    }
    navigate('/login', { replace: true });
  };

  // ── Verify attendance ─────────────────────────────────────────────────────────
  const verifyAttendance = async () => {
    if (!sessionId || !qrToken) {
      setUiState(STATES.QR_INVALID);
      return;
    }

    try {
      const data = await request('/qr-attendance/mark', {
        method: 'POST',
        body: { session_id: parseInt(sessionId, 10), qr_token: qrToken }
      });

      if (data.code === 'ATTENDANCE_MARKED') {
        setAttendance(data.attendance);
        setUiState(STATES.SUCCESS);
      } else if (data.code === 'ALREADY_MARKED') {
        setAttendance(data.attendance);
        setUiState(STATES.ALREADY_MARKED);
      } else {
        setErrorMsg(data.message || '');
        setUiState(STATES.QR_INVALID);
      }
    } catch (err) {
      const msg = err.message || '';
      
      // Token එක අවලංගු හෝ කල් ඉකුත් වී ඇත්නම්, එය ඉවත් කර ලොගින් පිටුවට යොමු කිරීම
      if (
        msg.includes('Failed to authenticate token') ||
        msg.includes('No token provided') ||
        msg.toLowerCase().includes('token') ||
        msg.toLowerCase().includes('unauthorized')
      ) {
        sessionStorage.removeItem('token');
        redirectToLogin();
        return;
      }

      if (msg.includes('QR_EXPIRED') || msg.toLowerCase().includes('expired')) {
        setUiState(STATES.QR_EXPIRED);
      } else if (msg.includes('SESSION_INACTIVE') || msg.toLowerCase().includes('inactive')) {
        setUiState(STATES.SESSION_INACTIVE);
      } else if (msg.includes('NOT_ENROLLED') || msg.toLowerCase().includes('enrolled')) {
        setUiState(STATES.NOT_ENROLLED);
      } else if (msg.includes('QR_INVALID') || msg.toLowerCase().includes('invalid')) {
        setUiState(STATES.QR_INVALID);
      } else if (msg.includes('FORBIDDEN') || msg.includes('Student')) {
        sessionStorage.removeItem('token');
        setUiState(STATES.FORBIDDEN);
      } else if (!navigator.onLine) {
        setUiState(STATES.NETWORK_ERROR);
      } else {
        setErrorMsg(msg);
        setUiState(STATES.NETWORK_ERROR);
      }
    }
  };

  // ── On mount: check auth → verify ────────────────────────────────────────────
  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    if (!isAuthenticated()) {
      redirectToLogin();
      return;
    }

    verifyAttendance();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const config = RESULT_CONFIG[uiState] || RESULT_CONFIG.QR_INVALID;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-900 flex items-center justify-center p-4">
      {/* Card */}
      <div className={`w-full max-w-sm bg-gradient-to-br ${config.bgFrom} ${config.bgTo} border-2 ${config.borderColor} rounded-3xl shadow-2xl overflow-hidden`}>

        {/* Header Band */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 px-6 py-4 text-center">
          <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">Thusitha Academy</p>
          <h1 className="text-white font-extrabold text-lg">QR Attendance</h1>
        </div>

        <div className="p-8 text-center space-y-4">
          {/* Loading State */}
          {uiState === STATES.LOADING && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 border-4 border-indigo-700 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="font-bold text-indigo-900 text-xl">Verifying Attendance</p>
              <p className="text-indigo-600 text-sm">කරුණාකර රැඳී සිටින්න...</p>
            </>
          )}

          {/* Result States */}
          {uiState !== STATES.LOADING && (
            <>
              {/* Big Icon */}
              <div className="flex justify-center"><config.icon className="w-16 h-16" /></div>

              {/* Titles */}
              <div>
                <h2 className={`text-xl font-extrabold leading-tight ${config.titleColor}`}>{config.titleEn}</h2>
                <p className="text-sm text-gray-600 mt-1">{config.title}</p>
              </div>

              {/* Attendance Details (success / already marked) */}
              {attendance && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 text-left space-y-2 border border-white/50">
                  {attendance.student_name && (
                    <DetailRow label="ශිෂ්‍ය නාමය" value={attendance.student_name} />
                  )}
                  {attendance.course_name && (
                    <DetailRow label="පන්තිය" value={attendance.course_name} />
                  )}
                  <DetailRow
                    label="පැමිණීම"
                    value={<span className="font-bold text-green-700">PRESENT</span>}
                  />
                  {attendance.method && (
                    <DetailRow label="ක්‍රමය" value={attendance.method} />
                  )}
                  {attendance.marked_time && (
                    <DetailRow
                      label="සටහන් කළ වේලාව"
                      value={new Date(attendance.marked_time).toLocaleTimeString('si-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    />
                  )}
                </div>
              )}

              {/* Error message */}
              {errorMsg && (
                <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2">{errorMsg}</p>
              )}

              {/* ALREADY_MARKED note */}
              {uiState === STATES.ALREADY_MARKED && (
                <p className="text-sm text-blue-600">ඔබගේ පැමිණීම දැනටමත් සාර්ථකව සටහන් කර ඇත.</p>
              )}

              {/* Network retry */}
              {uiState === STATES.NETWORK_ERROR && (
                <button
                  onClick={() => { setUiState(STATES.LOADING); hasAttempted.current = false; verifyAttendance(); }}
                  className="px-6 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold text-sm transition-all"
                >
                  නැවත උත්සාහ කරන්න
                </button>
              )}

              {/* FORBIDDEN: go to login */}
              {uiState === STATES.FORBIDDEN && (
                <button
                  onClick={redirectToLogin}
                  className="px-6 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Student ලෙස Login වන්න
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-indigo-900/10 px-6 py-3 text-center">
          <p className="text-xs text-gray-500">Thusitha Smart Class Management System</p>
        </div>
      </div>
    </div>
  );
};

// ── Detail Row ─────────────────────────────────────────────────────────────────
const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-500 font-medium">{label}</span>
    <span className="text-gray-900 font-semibold">{value}</span>
  </div>
);

export default QRVerifyPage;
