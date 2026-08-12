import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false); // 💡 සාර්ථක පණිවිඩය පාලනය කරන State එක
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await authService.login(username, password);
      
      // 💡 බ්‍රවුසර් Alert එක වෙනුවට අපේම සිස්ටම් එකේ Modal එක ඔන් කරනවා
      setShowSuccessModal(true);
      
      // 💡 තත්පර 2.5 කින් පසු ඉබේම Dashboard එකට රැගෙන යාම
      setTimeout(() => {
        setShowSuccessModal(false);
        const returnPath = sessionStorage.getItem('qr_return_path');
        if (returnPath) {
          sessionStorage.removeItem('qr_return_path');
          navigate(returnPath);
        } else {
          navigate('/dashboard');
        }
      }, 2500);
      
    } catch (err) {
      if (err.message.includes('Invalid')) {
        setError('❌ ඇතුළත් කළ Username හෝ Password වැරදියි!');
      } else if (err.message.includes('Network Error')) {
        setError('⚠️ පද්ධතිය සම්බන්ධ කිරීමේ දෝෂයකි. කරුණාකර පසුව නැවත උත්සාහ කරන්න.');
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Thusitha Institute</h2>
        </div>
        
        {error && (
          <div style={{ 
            color: '#d32f2f', 
            backgroundColor: '#ffebee', 
            padding: '10px', 
            borderRadius: '6px', 
            marginBottom: '15px', 
            fontWeight: '600',
            fontSize: '14px',
            border: '1px solid #ffcdd2'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="username-input">Username</label>
            <input 
              id="username-input"
              type="text" 
              placeholder="Enter your username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <label htmlFor="password-input">Password</label>
            <input 
              id="password-input"
              type="password" 
              placeholder="Enter your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="login-btn">Sign In</button>
        </form>
      </div>

      {/* 💡 මෙන්න ලෙක්චරර් කියපු විදිහට සිස්ටම් එක ඇතුළෙන්ම පෙනෙන ලස්සන පිළිගැනීමේ පණිවිඩය (Custom Modal) */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000,
          fontFamily: 'Segoe UI'
        }}>
          <div style={{
            backgroundColor: '#white',
            background: 'white',
            padding: '30px 40px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.3s ease-in-out'
          }}>
            <div style={{ fontSize: '50px', marginBottom: '10px' }}>🌟</div>
            <h2 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>ආයුබෝවන්!</h2>
            <p style={{ fontSize: '16px', color: '#333', margin: 0, fontWeight: '500' }}>
              තුසිත ආයතන වෙබ් අඩවියට සාදරයෙන් පිළිගනිමු.
            </p>
            <div style={{ marginTop: '15px', color: '#666', fontSize: '13px' }}>
              පද්ධතියට ඇතුල් වෙමින් පවතී, කරුණාකර රැඳී සිටින්න...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;