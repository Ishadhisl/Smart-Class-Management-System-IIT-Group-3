import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import PropTypes from 'prop-types';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const value = useMemo(() => ({ showNotification }), [showNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '12px 25px',
          borderRadius: '8px',
          backgroundColor: notification.type === 'success' ? '#2e7d32' : '#d32f2f',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: 'Segoe UI'
        }}>
          <span style={{ display: 'inline-flex' }}>{notification.type === 'success' ? <CheckCircle size={18} /> : notification.type === 'error' ? <XCircle size={18} /> : <Info size={18} />}</span>
          <span style={{ fontWeight: '500' }}>{notification.message}</span>
        </div>
      )}
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}
      </style>
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useNotification = () => useContext(NotificationContext);