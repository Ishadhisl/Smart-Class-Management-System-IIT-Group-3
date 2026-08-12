import React from 'react';
import PropTypes from 'prop-types';

const getActionBadgeStyles = (actionType) => {
  const baseStyles = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };

  switch (actionType) {
    case 'CREATE':
      return { ...baseStyles, backgroundColor: '#e8f5e9', color: '#2e7d32' };
    case 'UPDATE':
      return { ...baseStyles, backgroundColor: '#e3f2fd', color: '#1565c0' };
    case 'DELETE':
      return { ...baseStyles, backgroundColor: '#ffebee', color: '#d32f2f' };
    default:
      return { ...baseStyles, backgroundColor: '#f5f5f5', color: '#333' };
  }
};

const AuditLogTab = ({ logs }) => {
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h3 style={{ color: '#1a237e', margin: '0 0 20px 0' }}>📋 පද්ධති විගණන වාර්තා (Audit Logs)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>දිනය සහ වේලාව</th>
            <th style={{ padding: '12px' }}>ක්‍රියාව සිදු කළේ</th>
            <th style={{ padding: '12px' }}>ක්‍රියාව</th>
            <th style={{ padding: '12px' }}>විස්තරය</th>
            <th style={{ padding: '12px' }}>අදාළ අයිතමය</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>වාර්තා කිසිවක් නොමැත.</td></tr>}
          {logs.map((log) => (
            <tr key={log.log_id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px', fontSize: '13px' }}>{new Date(log.timestamp).toLocaleString()}</td>
              <td style={{ padding: '12px' }}>
                <strong>{log.performed_by_username || 'Public'}</strong><br />
                <span style={{ fontSize: '12px', color: '#666' }}>{log.user_role}</span>
              </td>
              <td style={{ padding: '12px' }}>
                <span style={getActionBadgeStyles(log.action_type)}>
                  {log.action_type}
                </span>
              </td>
              <td style={{ padding: '12px', fontSize: '14px', maxWidth: '300px' }}>{log.description}</td>
              <td style={{ padding: '12px', fontSize: '14px' }}>
                {log.entity_type} {log.entity_id ? `(ID: ${log.entity_id})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

AuditLogTab.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      log_id: PropTypes.number.isRequired,
      performed_by_username: PropTypes.string,
      user_role: PropTypes.string,
      action_type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired,
      entity_type: PropTypes.string.isRequired,
      entity_id: PropTypes.number,
    })
  ).isRequired,
};

export default AuditLogTab;