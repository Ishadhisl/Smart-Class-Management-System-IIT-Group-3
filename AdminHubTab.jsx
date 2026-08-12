import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ContactTab from './ContactTab';
import SMSLogTab from './SMSLogTab';
import SettingsTab from './SettingsTab';
import ReminderTab from './ReminderTab';

const AdminHubTab = ({
  // Inquiries props
  inquiries,
  onMarkRead,
  onMarkSpam,
  onRecoverFromSpam,
  onMarkAllRead,
  onToggleImportant,
  onQuickReply,
  // SMS/WhatsApp props
  smsLogs,
  onResendSMS,
  onDeleteSMSLog,
  onBulkResendSMS,
  onResendFilteredFailed,
  // Reminder props
  students,
  courses,
  onSendReminder,
  whatsappStatus,
  // Settings props
  systemSettings,
  onUpdateSetting,
  onCreateSetting,
  onDeleteSetting,
  onTriggerDrill,
}) => {
  const [subTab, setSubTab] = useState('inquiries');

  const unreadCount = inquiries.filter(m => !m.is_read && m.status !== 'Spam').length;
  const failedSMSCount = smsLogs.filter(l => l.whatsapp_status === 'Failed' || l.status === 'Failed').length;

  const smsTemplates = systemSettings
    .filter(s => s.setting_key.startsWith('sms_tpl_'))
    .map(s => s.setting_value);

  const tabs = [
    { key: 'inquiries',  label: 'වෙබ් විමසීම්',    icon: '✉️', badge: unreadCount },
    { key: 'reminder',   label: 'WhatsApp Reminder', icon: '💬', badge: 0, activeColor: '#25d366' },
    { key: 'sms_logs',   label: 'WhatsApp වාර්තා',  icon: '📱', badge: failedSMSCount, badgeColor: '#d32f2f' },
    { key: 'settings',   label: 'පද්ධති සැකසුම්',   icon: '⚙️', badge: 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <h2 style={{ margin: '0 0 4px 0', color: '#1a237e', fontSize: '22px', fontWeight: '800' }}>
          📬 සන්නිවේදන මධ්‍යස්ථානය
        </h2>
        <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
          වෙබ් විමසීම්, WhatsApp වාර්තා සහ පද්ධති සැකසුම් — එකම ස්ථානයකින් කළමනාකරණය කරන්න.
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '24px',
        padding: '6px',
        backgroundColor: '#f0f4ff',
        borderRadius: '14px',
        border: '1px solid #e3e8f8',
        width: 'fit-content',
      }}>
        {tabs.map(tab => {
          const isActive = subTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? '700' : '500',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                backgroundColor: isActive ? '#1a237e' : 'transparent',
                color: isActive ? 'white' : '#555',
                boxShadow: isActive ? '0 4px 12px rgba(26, 35, 126, 0.25)' : 'none',
                position: 'relative',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 5px',
                  borderRadius: '10px',
                  backgroundColor: tab.badgeColor || '#e53935',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '700',
                  lineHeight: 1,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      {subTab === 'inquiries' && (
        <ContactTab
          messages={inquiries}
          onMarkRead={onMarkRead}
          onMarkSpam={onMarkSpam}
          onRecoverFromSpam={onRecoverFromSpam}
          onMarkAllRead={onMarkAllRead}
          templates={smsTemplates}
          onToggleImportant={onToggleImportant}
          onQuickReply={onQuickReply}
        />
      )}

      {subTab === 'reminder' && (
        <ReminderTab
          students={students || []}
          courses={courses || []}
          onSendReminder={onSendReminder}
          whatsappStatus={whatsappStatus}
        />
      )}

      {subTab === 'sms_logs' && (
        <SMSLogTab
          logs={smsLogs}
          onResend={onResendSMS}
          onDelete={onDeleteSMSLog}
          onBulkResend={onBulkResendSMS}
          onResendFilteredFailed={onResendFilteredFailed}
          whatsappStatus={whatsappStatus}
        />
      )}

      {subTab === 'settings' && (
        <SettingsTab
          settings={systemSettings}
          onUpdate={onUpdateSetting}
          onCreate={onCreateSetting}
          onDelete={onDeleteSetting}
          onTriggerDrill={onTriggerDrill}
        />
      )}
    </div>
  );
};

AdminHubTab.propTypes = {
  // Inquiries
  inquiries: PropTypes.array.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onMarkSpam: PropTypes.func.isRequired,
  onRecoverFromSpam: PropTypes.func.isRequired,
  onMarkAllRead: PropTypes.func.isRequired,
  onToggleImportant: PropTypes.func.isRequired,
  onQuickReply: PropTypes.func.isRequired,
  // SMS/WhatsApp
  smsLogs: PropTypes.array.isRequired,
  onResendSMS: PropTypes.func.isRequired,
  onDeleteSMSLog: PropTypes.func.isRequired,
  onBulkResendSMS: PropTypes.func.isRequired,
  onResendFilteredFailed: PropTypes.func.isRequired,
  // Reminder
  students: PropTypes.array,
  courses: PropTypes.array,
  onSendReminder: PropTypes.func,
  whatsappStatus: PropTypes.object,
  // Settings
  systemSettings: PropTypes.array.isRequired,
  onUpdateSetting: PropTypes.func.isRequired,
  onCreateSetting: PropTypes.func.isRequired,
  onDeleteSetting: PropTypes.func.isRequired,
  onTriggerDrill: PropTypes.func.isRequired,
};

export default AdminHubTab;
