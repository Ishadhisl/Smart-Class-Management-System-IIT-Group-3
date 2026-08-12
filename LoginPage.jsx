import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { FaEye, FaEyeSlash, FaWhatsapp } from 'react-icons/fa';
import { authService } from '../../services/authService';
import { request } from '../../services/api';

const PRIMARY_NAVY = '#070D59';
const SECONDARY_BLUE = '#1F3C88';
const WA_GREEN = '#25d366';

const LoginPage = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();
  const [showPassword, setShowPassword] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // First-time password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // ═══════════════════════════════════════════
  // Forgot Password — 3-step OTP Flow
  // ═══════════════════════════════════════════
  const [forgotStep, setForgotStep] = useState(0); // 0=login, 1=enter-user, 2=enter-otp, 3=new-password
  const [fpUsername, setFpUsername] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpConfirmPw, setFpConfirmPw] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpPhoneHint, setFpPhoneHint] = useState('');

  // Helper: get and consume the QR return path from sessionStorage (open-redirect safe)
  const consumeReturnPath = () => {
    const stored = sessionStorage.getItem('qr_return_path');
    if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
      sessionStorage.removeItem('qr_return_path');
      return stored;
    }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      showNotification('කරුණාකර හිස්ව ඇති තොරතුරු පුරවන්න.', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await authService.login(credentials.username, credentials.password);
      
      if (data.must_change_password) {
        setShowPasswordChange(true);
        showNotification('ඔබ ප්‍රථම වරට Login වෙයි. කරුණාකර නව මුරපදයක් සකසන්න.');
      } else {
        showNotification('සාර්ථකව ඇතුළු විය!');
        const returnPath = consumeReturnPath();
        navigate(returnPath || '/dashboard');
      }
    } catch (err) {
      showNotification(err.message || 'සම්බන්ධතාවයේ දෝෂයකි.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { showNotification('මුරපදය අවම වශයෙන් අකුරු 6ක් විය යුතුයි.', 'error'); return; }
    if (newPassword !== confirmPassword) { showNotification('මුරපද දෙක සමාන නොවේ.', 'error'); return; }
    setChangingPassword(true);
    try {
      await request('/auth/change-password', { method: 'POST', body: { newPassword } });
      showNotification('මුරපදය සාර්ථකව වෙනස් කළා! Dashboard එකට යොමු වෙයි...');
      setShowPasswordChange(false);
      const returnPath = consumeReturnPath();
      navigate(returnPath || '/dashboard');
    } catch (err) {
      showNotification(err.message || 'මුරපදය වෙනස් කිරීමේ දෝෂයකි.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Step 1: Username submit → OTP send via WhatsApp
  const handleFpSendOtp = async (e) => {
    e.preventDefault();
    if (!fpUsername.trim()) { showNotification('Username ඇතුළත් කරන්න.', 'error'); return; }
    setFpLoading(true);
    try {
      const res = await request('/auth/forgot-password', {
        method: 'POST', body: { username: fpUsername }, noAuth: true
      });
      setFpPhoneHint(res.phone_hint || '');
      setForgotStep(2);
      showNotification('WhatsApp OTP code යවන ලදී! 📱');
    } catch (err) {
      showNotification(err.message || 'OTP යැවීමේ දෝෂයකි.', 'error');
    } finally {
      setFpLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleFpVerifyOtp = async (e) => {
    e.preventDefault();
    if (fpOtp.length !== 6) { showNotification('6-digit OTP ඇතුළත් කරන්න.', 'error'); return; }
    setFpLoading(true);
    try {
      await request('/auth/verify-otp', {
        method: 'POST', body: { username: fpUsername, otp: fpOtp }, noAuth: true
      });
      setForgotStep(3);
      showNotification('OTP සාර්ථකයි! නව මුරපදය සකසන්න.');
    } catch (err) {
      showNotification(err.message || 'OTP වැරදියි.', 'error');
    } finally {
      setFpLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleFpResetPassword = async (e) => {
    e.preventDefault();
    if (fpNewPw.length < 6) { showNotification('මුරපදය අකුරු 6ක් විය යුතු.', 'error'); return; }
    if (fpNewPw !== fpConfirmPw) { showNotification('මුරපද දෙකෙ ගළපෙ නෑ.', 'error'); return; }
    setFpLoading(true);
    try {
      await request('/auth/reset-with-otp', {
        method: 'POST', body: { username: fpUsername, otp: fpOtp, newPassword: fpNewPw }, noAuth: true
      });
      showNotification('🎉 මුරපදය සාර්ථකව නැවත සකසන ලදී!');
      setForgotStep(0);
      setFpUsername(''); setFpOtp(''); setFpNewPw(''); setFpConfirmPw('');
    } catch (err) {
      showNotification(err.message || 'Reset error.', 'error');
    } finally {
      setFpLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box'
  };
  const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '500' };
  const btnStyle = (color, disabled) => ({
    width: '100%', padding: '14px', backgroundColor: disabled ? '#ccc' : color,
    color: 'white', border: 'none', borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 'bold',
    fontSize: '16px', transition: 'all 0.3s ease', opacity: disabled ? 0.7 : 1
  });

  // ═══════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════
  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' }}>
      {/* Breadcrumb */}
      <div style={{ position: 'absolute', top: '20px', left: '5%', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SECONDARY_BLUE, fontWeight: '500', fontFamily: 'inherit', fontSize: 'inherit' }}>
          මුල් පිටුව
        </button>
        <span>&gt;</span>
        <span style={{ color: PRIMARY_NAVY, fontWeight: 'bold' }}>Login</span>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', padding: '40px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src="/Project%20LOGO.png" alt="Logo" style={{ width: '80px', marginBottom: '15px' }} />
          <h2 style={{ margin: 0, color: PRIMARY_NAVY }}>
            {forgotStep === 0 && !showPasswordChange && 'පද්ධතියට ඇතුළු වන්න'}
            {showPasswordChange && 'නව මුරපදයක් සකසන්න'}
            {forgotStep === 1 && '🔐 Username ඇතුළත් කරන්න'}
            {forgotStep === 2 && '📱 WhatsApp OTP Enter'}
            {forgotStep === 3 && '🔑 නව මුරපදය සකසන්න'}
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
            {forgotStep === 0 && !showPasswordChange && 'Thusitha Smart Class Management'}
            {forgotStep === 1 && 'ඔබගේ Username ඇතුළත් කරන්න — WhatsApp OTP code ලැබේ.'}
            {forgotStep === 2 && `📲 ඔබගේ WhatsApp ${fpPhoneHint} ලැබෙන 6-digit OTP ඇතුළත් කරන්න.`}
            {forgotStep === 3 && 'නව ශක්තිමත් මුරපදයක් සකසන්න.'}
          </p>
        </div>

        {/* ═══ STEP 0: Normal Login ═══ */}
        {forgotStep === 0 && !showPasswordChange && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="username" style={labelStyle}>පරිශීලක නාමය (Username)</label>
              <input id="username" type="text" required style={inputStyle}
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('password').focus(); } }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="password" style={labelStyle}>මුරපදය (Password)</label>
              <div style={{ position: 'relative' }}>
                <input id="password" type={showPassword ? 'text' : 'password'} required
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '18px' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <button type="button" onClick={() => setForgotStep(1)}
                style={{ background: 'none', border: 'none', color: WA_GREEN, cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <FaWhatsapp /> මුරපදය අමතක වූවාද? (WhatsApp OTP)
              </button>
            </div>

            <button type="submit" disabled={loading} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
              style={btnStyle(isHovered ? SECONDARY_BLUE : PRIMARY_NAVY, loading)}
            >
              {loading ? 'පරීක්ෂා කරමින්...' : 'ඇතුළු වන්න'}
            </button>
          </form>
        )}

        {/* ═══ First-time Password Change ═══ */}
        {showPasswordChange && (
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="newPassword" style={labelStyle}>නව මුරපදය</label>
              <input id="newPassword" type="password" required minLength={6} style={inputStyle}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="අවම අකුරු 6ක්" />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label htmlFor="confirmPassword" style={labelStyle}>මුරපදය තහවුරු කරන්න</label>
              <input id="confirmPassword" type="password" required minLength={6} style={inputStyle}
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="නැවත ඇතුළත් කරන්න" />
            </div>
            <button type="submit" disabled={changingPassword} style={btnStyle('#2e7d32', changingPassword)}>
              {changingPassword ? 'සුරකිමින්...' : '🔐 මුරපදය සුරකින්න'}
            </button>
          </form>
        )}

        {/* ═══ STEP 1: Enter Username ═══ */}
        {forgotStep === 1 && (
          <form onSubmit={handleFpSendOtp}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>👤 Username</label>
              <input type="text" required style={inputStyle} value={fpUsername} onChange={e => setFpUsername(e.target.value)} placeholder="ඔබගේ username ඇතුළත් කරන්න" autoFocus />
            </div>
            <div style={{ padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: '#2e7d32', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <FaWhatsapp style={{ fontSize: '20px' }} />
              <span>ඔබගේ ගිණුමට සම්බන්ධ WhatsApp number වෙත OTP code එකක් ලැබේ.</span>
            </div>
            <button type="submit" disabled={fpLoading} style={btnStyle(WA_GREEN, fpLoading)}>
              {fpLoading ? 'OTP යවමින්...' : '💬 WhatsApp OTP Send කරන්න'}
            </button>
            <button type="button" onClick={() => setForgotStep(0)} style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'none', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              ← Login වෙත යන්න
            </button>
          </form>
        )}

        {/* ═══ STEP 2: Enter OTP ═══ */}
        {forgotStep === 2 && (
          <form onSubmit={handleFpVerifyOtp}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>🔢 WhatsApp OTP Code (6 digits)</label>
              <input type="text" required maxLength={6} inputMode="numeric" pattern="[0-9]{6}"
                style={{ ...inputStyle, fontSize: '28px', letterSpacing: '8px', textAlign: 'center', fontWeight: 'bold' }}
                value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus />
            </div>
            <div style={{ padding: '10px 14px', backgroundColor: '#fff3e0', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#e65100' }}>
              ⏰ OTP code 10 මිනිත්තු ඇතුළත භාවිත නොකළ expire වේ.
            </div>
            <button type="submit" disabled={fpLoading || fpOtp.length !== 6} style={btnStyle(PRIMARY_NAVY, fpLoading || fpOtp.length !== 6)}>
              {fpLoading ? 'Verifying...' : '✅ OTP Verify කරන්න'}
            </button>
            <button type="button" onClick={() => { setForgotStep(1); setFpOtp(''); }} style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'none', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              ← OTP නැවත ලබාගන්න
            </button>
          </form>
        )}

        {/* ═══ STEP 3: New Password ═══ */}
        {forgotStep === 3 && (
          <form onSubmit={handleFpResetPassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>🔑 නව මුරපදය</label>
              <input type="password" required minLength={6} style={inputStyle}
                value={fpNewPw} onChange={e => setFpNewPw(e.target.value)} placeholder="අවම වශයෙන් අකුරු 6ක්" autoFocus />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>🔁 නව මුරපදය නැවත ඇතුළත් කරන්න</label>
              <input type="password" required minLength={6} style={inputStyle}
                value={fpConfirmPw} onChange={e => setFpConfirmPw(e.target.value)} placeholder="Confirm password" />
            </div>
            {fpNewPw && fpConfirmPw && fpNewPw !== fpConfirmPw && (
              <p style={{ color: '#d32f2f', fontSize: '12px', marginBottom: '12px' }}>⚠️ මුරපද දෙකෙ ගළපෙ නෑ</p>
            )}
            <button type="submit" disabled={fpLoading} style={btnStyle('#2e7d32', fpLoading)}>
              {fpLoading ? 'සුරකිමින්...' : '🔐 මුරපදය Reset කරන්න'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
