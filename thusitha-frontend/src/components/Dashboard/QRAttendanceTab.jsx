import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import QRCode from 'qrcode';
import { request, API_URL } from '../../services/api';

// APP_URL is fetched dynamically from backend to always use the machine's
// real network IP — even when the admin browses via localhost (needed for webcam).


// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    ACTIVE:   { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'සක්‍රිය (ACTIVE)' },
    EXPIRED:  { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500',   label: 'කාලය ඉකුත් (EXPIRED)' },
    STOPPED:  { bg: 'bg-gray-100',  text: 'text-gray-700',  dot: 'bg-gray-500',  label: 'නවත්වා ඇත (STOPPED)' },
    CLOSED:   { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', label: 'වසා ඇත (CLOSED)' },
  };
  const s = map[status] || map.EXPIRED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
};
StatusBadge.propTypes = { status: PropTypes.string };

// ── Countdown ─────────────────────────────────────────────────────────────────
const Countdown = ({ expiresAt, onExpired }) => {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, new Date(expiresAt) - Date.now());
      if (diff === 0) { setRemaining('00:00'); onExpired?.(); return; }
      const m = String(Math.floor(diff / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setRemaining(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  return <span className="font-mono text-3xl font-bold text-red-600">{remaining}</span>;
};
Countdown.propTypes = { expiresAt: PropTypes.string, onExpired: PropTypes.func };

// ── Summary Card ──────────────────────────────────────────────────────────────
const SummaryCard = ({ label, value, color }) => (
  <div className={`rounded-2xl p-5 shadow-sm border ${color} flex flex-col items-center`}>
    <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">{label}</p>
    <p className="text-4xl font-extrabold">{value ?? '—'}</p>
  </div>
);
SummaryCard.propTypes = { label: PropTypes.string, value: PropTypes.number, color: PropTypes.string };

const QRAttendanceTab = ({ courses }) => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [session, setSession]       = useState(null); // active session object
  const [qrDataUrl, setQrDataUrl]   = useState('');
  const [qrUrl, setQrUrl]           = useState('');
  const [students, setStudents]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [listLoading, setListLoading]       = useState(false);
  const [error, setError]           = useState('');
  const pollingRef                  = useRef(null);
  const [networkFrontendUrl, setNetworkFrontendUrl] = useState(null); // real network IP URL

  // ── Fetch the machine's real network IP from backend on mount ───────────────
  useEffect(() => {
    const fetchNetworkIp = async () => {
      try {
        const res = await fetch(`${API_URL}/api/system/ip`);
        const data = await res.json();
        if (data.frontendUrl) {
          setNetworkFrontendUrl(data.frontendUrl);
        }
      } catch (e) {
        // If backend unreachable, fall back to browser URL
        console.warn('Could not fetch network IP, falling back to window.location.origin', e);
        setNetworkFrontendUrl(window.location.origin);
      }
    };
    fetchNetworkIp();
  }, []);

  // ── Stop polling ────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  // ── Fetch attendance list ────────────────────────────────────────────────────
  const fetchAttendanceList = useCallback(async (sid) => {
    if (!sid) return;
    setListLoading(true);
    try {
      const data = await request(`/qr-attendance/sessions/${sid}/attendance`);
      setStudents(data.students || []);
      setSummary(data.summary || null);
    } catch (e) {
      console.error('Attendance list error:', e.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  // ── Generate QR image ────────────────────────────────────────────────────────
  const generateQR = useCallback(async (url) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 280,
        color: { dark: '#070D59', light: '#FFFFFF' }
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.error('QR generation error:', e);
    }
  }, []);

  // ── Start session ────────────────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!selectedCourse) { setError('කරුණාකර පන්තියක් තෝරන්න.'); return; }
    setSessionLoading(true); setError('');
    try {
      const data = await request('/qr-attendance/sessions', {
        method: 'POST',
        body: { course_id: parseInt(selectedCourse, 10) }
      });
      const rawToken = data.session.raw_token;
      const sid      = data.session.session_id;
      // Use network IP URL so phones on the same WiFi can open the QR link.
      // Falls back to window.location.origin if IP not yet fetched.
      const appUrl   = networkFrontendUrl || window.location.origin;
      const url      = `${appUrl}/attendance/verify/${sid}?token=${rawToken}`;
      setQrUrl(url);
      setSession({ ...data.session, status: 'ACTIVE' });
      await generateQR(url);
      await fetchAttendanceList(sid);

      // Start polling every 5s
      pollingRef.current = setInterval(() => fetchAttendanceList(sid), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSessionLoading(false);
    }
  };

  // ── Stop session ─────────────────────────────────────────────────────────────
  const handleStopSession = async () => {
    if (!session?.session_id) return;
    if (!window.confirm('QR Attendance සැසිය නවත්වීමට ඔබ වග බලා ගන්නවාද?')) return;
    setSessionLoading(true);
    try {
      await request(`/qr-attendance/sessions/${session.session_id}/stop`, { method: 'PATCH' });
      setSession(prev => ({ ...prev, status: 'STOPPED' }));
      setQrDataUrl('');
      stopPolling();
    } catch (e) {
      setError(e.message);
    } finally {
      setSessionLoading(false);
    }
  };

  // ── Handle QR expiry ─────────────────────────────────────────────────────────
  const handleQRExpired = useCallback(() => {
    setSession(prev => prev ? { ...prev, status: 'EXPIRED' } : prev);
    setQrDataUrl('');
    stopPolling();
  }, [stopPolling]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Reset when course changes ─────────────────────────────────────────────────
  useEffect(() => {
    stopPolling();
    setSession(null);
    setQrDataUrl('');
    setQrUrl('');
    setStudents([]);
    setSummary(null);
    setError('');
  }, [selectedCourse, stopPolling]);

  const isActive = session?.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-extrabold tracking-tight mb-1">📲 QR Attendance කළමනාකරණය</h2>
        <p className="text-indigo-200 text-sm">QR Code ස්කෑන් කිරීමෙන් ශිෂ්‍ය පැමිණීම ස්වයංක්‍රීයව සටහන් කරන්න.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Course Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          1. පන්තිය තෝරන්න (Select Class)
        </label>
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          disabled={isActive || sessionLoading}
          className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="">-- පන්තියක් තෝරන්න --</option>
          {courses.map(c => (
            <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
          ))}
        </select>
      </div>

      {/* Session Control */}
      {selectedCourse && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Session තත්ත්වය</p>
            <StatusBadge status={session?.status || 'NOT_STARTED'} />
          </div>

          {!isActive ? (
            <button
              onClick={handleStartSession}
              disabled={sessionLoading}
              className="px-6 py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {sessionLoading ? '⏳ සකස් වෙමින්...' : '▶️ QR Attendance ආරම්භ කරන්න'}
            </button>
          ) : (
            <button
              onClick={handleStopSession}
              disabled={sessionLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {sessionLoading ? '⏳...' : '⏹️ QR Attendance නවත්වන්න'}
            </button>
          )}
        </div>
      )}

      {/* QR Code Display */}
      {isActive && qrDataUrl && (
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 flex flex-col md:flex-row gap-8 items-center">
          {/* QR Image */}
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 border-4 border-indigo-700 rounded-2xl shadow-lg bg-white">
              <img src={qrDataUrl} alt="QR Attendance" className="w-56 h-56" />
            </div>
            <p className="text-xs text-gray-500 text-center">ඔබේ Phone Camera යොදා QR Scan කරන්න</p>
          </div>

          {/* Session Info */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Class</p>
              <p className="text-xl font-bold text-indigo-900">{session.course_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">දිනය</p>
              <p className="text-base font-semibold">{new Date(session.session_date).toLocaleDateString('si-LK')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">QR කාලය ඉකුත් වේ</p>
              <Countdown expiresAt={session.expires_at} onExpired={handleQRExpired} />
            </div>
            <StatusBadge status="ACTIVE" />
          </div>
        </div>
      )}

      {/* Expired / Stopped notice */}
      {session && !isActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <p className="text-amber-800 font-bold text-lg">
            {session.status === 'EXPIRED' ? '⏰ QR Attendance කාලය ඉකුත් වී ඇත.' : '🛑 QR Attendance සැසිය නවත්වා ඇත.'}
          </p>
          <p className="text-amber-600 text-sm mt-1">නව සැසියක් ආරම්භ කිරීමට ඉහත බොත්තම ක්ලික් කරන්න.</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="ලියාපදිංචි (Total)" value={summary.total_enrolled} color="border-indigo-200 bg-indigo-50 text-indigo-900" />
          <SummaryCard label="පැමිණි (Present)" value={summary.present} color="border-green-200 bg-green-50 text-green-900" />
          <SummaryCard label="නොපැමිණි (Absent)" value={summary.not_present} color="border-red-200 bg-red-50 text-red-800" />
        </div>
      )}

      {/* Attendance Table */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-indigo-900">📋 ශිෂ්‍ය පැමිණීම් ලැයිස්තුව</h3>
            {listLoading && <span className="text-xs text-gray-400 animate-pulse">යාවත්කාලීන වෙමින්...</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Student ID</th>
                  <th className="px-6 py-3 text-left">ශිෂ්‍ය නාමය</th>
                  <th className="px-6 py-3 text-center">පැමිණීම් තත්ත්වය</th>
                  <th className="px-6 py-3 text-center">ක්‍රමය</th>
                  <th className="px-6 py-3 text-center">සටහන් කළ වේලාව</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(s => (
                  <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{s.student_ref_id || `#${s.student_id}`}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{s.student_name}</td>
                    <td className="px-6 py-4 text-center">
                      {s.attendance_status === 'PRESENT' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                          ✅ PRESENT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                          ❌ NOT PRESENT
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">{s.method || '—'}</td>
                    <td className="px-6 py-4 text-center text-gray-500 text-xs">
                      {s.marked_time ? new Date(s.marked_time).toLocaleTimeString('si-LK', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCourse && !session && !sessionLoading && (
        <p className="text-center text-gray-400 text-sm py-4">
          QR Attendance ආරම්භ කිරීමට ඉහත බොත්තම ක්ලික් කරන්න.
        </p>
      )}
    </div>
  );
};

QRAttendanceTab.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default QRAttendanceTab;
