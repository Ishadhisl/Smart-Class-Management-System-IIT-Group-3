import React, { useState } from 'react';
import PropTypes from 'prop-types';

const ApprovalTab = ({ pendingStudents, onApprove }) => {
  const [qrInputs, setQrInputs] = useState({});

  const handleApproveClick = (id) => {
    const qr = qrInputs[id];
    if (!qr) return alert('කරුණාකර QR ID එක ඇතුළත් කරන්න.');
    onApprove(id, qr);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>⏳ ශිෂ්‍ය අනුමැතිය (Pending Approvals)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>නම</th>
            <th style={{ padding: '12px' }}>ශ්‍රේණිය/පාසල</th>
            <th style={{ padding: '12px' }}>Interested Course</th>
            <th style={{ padding: '12px' }}>QR ID එක ඇතුළත් කරන්න</th>
            <th style={{ padding: '12px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {pendingStudents.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px' }}>{s.name}<br/><small>{s.phone}</small></td>
              <td style={{ padding: '12px' }}>{s.grade}<br/><small>{s.school}</small></td>
              <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', backgroundColor: '#e8eaf6', borderRadius: '4px', fontSize: '12px' }}>{s.course_interest || 'General'}</span></td>
              <td style={{ padding: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Scan or Enter QR"
                  value={qrInputs[s.id] || ''}
                  onChange={(e) => setQrInputs({...qrInputs, [s.id]: e.target.value})}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </td>
              <td style={{ padding: '12px' }}>
                <button 
                  onClick={() => handleApproveClick(s.id)}
                  style={{ padding: '8px 15px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                >Approve</button>
              </td>
            </tr>
          ))}
          {pendingStudents.length === 0 && (
            <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>දැනට අනුමැතිය සඳහා සිසුන් නැත.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

ApprovalTab.propTypes = {
  pendingStudents: PropTypes.array.isRequired,
  onApprove: PropTypes.func.isRequired
};

export default ApprovalTab;