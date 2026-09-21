import React, { useState } from 'react';
import PropTypes from 'prop-types';
import FormError from '../common/FormError';
import { validatePassword } from '../../utils/formValidation';
import PasswordRules from '../common/PasswordRules';

const thSticky = { padding: '12px', position: 'sticky', top: 0, backgroundColor: '#f5f5f5', zIndex: 1 };

// Login usernames: letters, digits, dot, underscore, hyphen (3-50 chars) - no spaces or HTML.
const USERNAME_RE = /^[A-Za-z0-9._-]{3,50}$/;
const filterUsernameInput = (v) => v.replace(/[^A-Za-z0-9._-]/g, '');

const UserTab = ({ users, onResetPassword, onCreateUser, onDeleteUser }) => {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Counter Person');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!username || !role) {
      setErrorMsg('කරුණාකර සියලු විස්තර ඇතුළත් කරන්න.');
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setErrorMsg('පරිශීලක නාමය අකුරු 3-50 අතර විය යුතු අතර අකුරු, ඉලක්කම්, . _ - පමණක් යෙදිය හැක.');
      return;
    }
    if (password) {
      // validatePassword returns an error string ('' when valid), not an object
      const passError = validatePassword(password);
      if (passError) {
        setErrorMsg(passError);
        return;
      }
    }
    setLoading(true);
    try {
      await onCreateUser({ username, password, role });
      setShowModal(false);
      setUsername('');
      setPassword('');
      setRole('Counter Person');
    } catch (err) {
      setErrorMsg(err.message || 'පරිශීලකයා එක් කිරීම අසාර්ථක විය.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ color: '#1a237e', margin: 0 }}>📚 පද්ධති පරිශීලකයින් සහ පන්ති දත්ත</h3>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#1a237e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(26, 35, 126, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ➕ නව කාර්ය මණ්ඩල සාමාජිකයෙක් එක් කරන්න
        </button>
      </div>

      {/* ~10 rows visible; the rest scroll inside the box (header stays pinned) */}
      <div style={{ maxHeight: 'max(300px, calc(100vh - 270px))', overflowY: 'auto', overflowX: 'auto', marginTop: '15px', border: '1px solid #e3e6f0', borderRadius: '10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={thSticky}>පරිශීලක නාමය (Username)</th>
            <th style={thSticky}>තනතුර (Role)</th>
            <th style={thSticky}>ක්‍රියාමාර්ග (Actions)</th>
          </tr>
        </thead>
        <tbody>
          {users.map((cls, index) => (
            <tr key={cls.user_id || cls._id || index} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px', fontWeight: '600', color: '#333' }}>{cls.username}</td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  backgroundColor: cls.role === 'Admin' ? '#e8eaf6' : '#e8f5e9',
                  color: cls.role === 'Admin' ? '#1a237e' : '#2e7d32',
                  padding: '4px 10px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold'
                }}>{cls.role}</span>
              </td>
              <td style={{ padding: '12px' }}>
                <button
                  onClick={() => onResetPassword(cls.user_id || cls._id)}
                  style={{ background: '#3f51b5', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '8px' }}
                >
                  Reset Pass
                </button>
                {cls.username !== 'admin' && (
                  <button
                    onClick={() => {
                      if (window.confirm(`මෙම පරිශීලකයා (${cls.username}) ඉවත් කිරීම ස්ථිරද?`)) {
                        onDeleteUser(cls.user_id || cls._id);
                      }
                    }}
                    style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* ADD STAFF MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1a237e', textAlign: 'center' }}>නව කාර්ය මණ්ඩල සාමාජිකයෙක් එක් කිරීම</h3>
            {errorMsg && <FormError className="mb-3">{errorMsg}</FormError>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="staff-username" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>පරිශීලක නාමය (Username)</label>
                <input
                  id="staff-username"
                  type="text"
                  placeholder="උදා: counter_lisa (e.g. counter_lisa)"
                  value={username}
                  onChange={(e) => {
                    const filtered = filterUsernameInput(e.target.value);
                    setUsername(filtered);
                    setErrorMsg(filtered !== e.target.value ? 'වලංගු නොවන ආදානයකි: පරිශීලක නාමයට අකුරු, ඉලක්කම්, . _ - පමණක් යොදන්න.' : '');
                  }}
                  maxLength={50}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="staff-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>මුරපදය (Password) <span style={{ fontWeight: 'normal', color: '#888' }}>— හිස්ව තැබුවොත් role default එක (Counter@123 / Admin@123)</span></label>
                <input
                  id="staff-password"
                  type="password"
                  placeholder="උදා: Nimal@2026"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
                {password && <PasswordRules value={password} />}
              </div>
              <div style={{ display: 'none' }}>
                <label htmlFor="staff-role" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>තනතුර (Role)</label>
                <select
                  id="staff-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                >
                  <option value="Counter Person">Counter Person</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setErrorMsg(''); }}
                  style={{ padding: '8px 16px', borderRadius: '5px', border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  අවලංගු කරන්න
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '8px 16px', borderRadius: '5px', background: '#1a237e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {loading ? 'සුරකිමින්...' : 'සුරකින්න'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

UserTab.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      user_id: PropTypes.number,
      username: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
    })
  ).isRequired,
  onResetPassword: PropTypes.func.isRequired,
  onCreateUser: PropTypes.func.isRequired,
  onDeleteUser: PropTypes.func.isRequired,
};

export default UserTab;