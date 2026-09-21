import React, { useState } from 'react';
import PropTypes from 'prop-types';
import FormError from '../common/FormError';
import { filterTextInput, TEXT_INVALID_MSG, validateText } from '../../utils/formValidation';

const SettingsTab = ({ settings, onUpdate, onCreate, onDelete, onTriggerDrill }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '' });

  const systemConfigs = localSettings.filter(s => !s.setting_key.startsWith('sms_tpl_') && !s.setting_key.startsWith('safety_'));
  const safetyConfigs = localSettings.filter(s => s.setting_key.startsWith('safety_'));
  const smsTemplates = localSettings.filter(s => s.setting_key.startsWith('sms_tpl_'));

  const [fieldNotice, setFieldNotice] = useState({});
  const [templateErrors, setTemplateErrors] = useState({});

  // Settings values are rendered back into pages/WhatsApp messages - never let <tags> in.
  const handleChange = (key, value) => {
    const filtered = filterTextInput(value);
    setFieldNotice(prev => ({ ...prev, [key]: filtered !== value ? TEXT_INVALID_MSG : '' }));
    setLocalSettings(prev => prev.map(s => s.setting_key === key ? { ...s, setting_value: filtered } : s));
  };

  const handleAddTemplate = () => {
    const errors = {
      name: validateText(newTemplate.name, { required: true, label: 'සැකිල්ලේ නම', min: 2, max: 50 }),
      content: validateText(newTemplate.content, { required: true, label: 'පණිවිඩය', min: 5, max: 1000 }),
    };
    setTemplateErrors(errors);
    if (errors.name || errors.content) return;
    onCreate({
      key: `sms_tpl_${newTemplate.name.toLowerCase().replaceAll(' ', '_')}`,
      value: newTemplate.content,
      description: `Quick Reply Template: ${newTemplate.name}`
    });
    setNewTemplate({ name: '', content: '' });
    setTemplateErrors({});
  };

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', marginTop: '5px' };

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', maxWidth: '600px' }}>
      <h3 style={{ color: '#1a237e', marginBottom: '25px' }}>⚙️ පද්ධති සැකසුම් (System Settings)</h3>

      {systemConfigs.map(setting => (
        <div key={setting.setting_key} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
          <label style={{ fontWeight: 'bold', color: '#333' }}>
            {setting.setting_key.replaceAll('_', ' ').toUpperCase()}
          </label>
          <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 8px 0' }}>{setting.description}</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={setting.setting_value}
              onChange={(e) => handleChange(setting.setting_key, e.target.value)}
              style={inputStyle}
              maxLength={2000}
            />
            <button
              onClick={() => onUpdate(setting.setting_key, setting.setting_value)}
              style={{ alignSelf: 'flex-end', padding: '10px 15px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Save
            </button>
          </div>
          {fieldNotice[setting.setting_key] && <FormError>{fieldNotice[setting.setting_key]}</FormError>}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px', marginBottom: '20px' }}>
        <h3 style={{ color: '#d32f2f', margin: 0 }}>🚨 ආරක්ෂක සැකසුම් (Safety & Congestion)</h3>
        <button
          onClick={onTriggerDrill}
          style={{ padding: '8px 15px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
        >🧪 Safety Drill</button>
      </div>
      <div style={{ padding: '20px', backgroundColor: '#fff5f5', borderRadius: '12px', border: '1px solid #ffcdd2' }}>
        {safetyConfigs.map(setting => (
          <div key={setting.setting_key} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid rgba(211, 47, 47, 0.1)' }}>
            <label style={{ fontWeight: 'bold', color: '#c53030' }}>
              {setting.setting_key.replace('safety_', '').replaceAll('_', ' ').toUpperCase()}
            </label>
            <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 8px 0' }}>{setting.description}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={setting.setting_value}
                onChange={(e) => handleChange(setting.setting_key, e.target.value)}
                style={inputStyle}
                maxLength={2000}
              />
              <button
                onClick={() => onUpdate(setting.setting_key, setting.setting_value)}
                style={{ alignSelf: 'flex-end', padding: '10px 15px', backgroundColor: '#c53030', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Update
              </button>
            </div>
            {fieldNotice[setting.setting_key] && <FormError>{fieldNotice[setting.setting_key]}</FormError>}
          </div>
        ))}
      </div>

      <h3 style={{ color: '#1a237e', marginTop: '40px', marginBottom: '20px' }}>📱 WhatsApp සැකිලි කළමනාකරණය (WhatsApp Templates)</h3>

      <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginBottom: '25px', border: '1px solid #eee' }}>
        <h5 style={{ margin: '0 0 10px 0' }}>නව සැකිල්ලක් එක් කරන්න (Add New)</h5>
        <input type="text" placeholder="උදා: General Welcome (සැකිල්ලේ නම) *" maxLength={50} style={{ ...inputStyle, ...(templateErrors.name ? { border: '1px solid #d32f2f' } : {}) }} value={newTemplate.name}
          onChange={e => { const v = filterTextInput(e.target.value); setNewTemplate({ ...newTemplate, name: v }); setTemplateErrors(prev => ({ ...prev, name: v !== e.target.value ? TEXT_INVALID_MSG : '' })); }} />
        {templateErrors.name && <FormError>{templateErrors.name}</FormError>}
        <textarea placeholder="උදා: ආයුබෝවන් {student_name}, ... (පණිවිඩය) *" maxLength={1000} style={{ ...inputStyle, height: '80px', marginTop: '10px', ...(templateErrors.content ? { border: '1px solid #d32f2f' } : {}) }} value={newTemplate.content}
          onChange={e => { const v = filterTextInput(e.target.value); setNewTemplate({ ...newTemplate, content: v }); setTemplateErrors(prev => ({ ...prev, content: v !== e.target.value ? TEXT_INVALID_MSG : '' })); }} />
        {templateErrors.content && <FormError>{templateErrors.content}</FormError>}
        <button onClick={handleAddTemplate} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>➕ එකතු කරන්න</button>
      </div>

      {smsTemplates.map(tpl => (
        <div key={tpl.setting_key} style={{ marginBottom: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <strong style={{ fontSize: '14px', color: '#1a237e' }}>{tpl.setting_key.replace('sms_tpl_', '').replaceAll('_', ' ').toUpperCase()}</strong>
            <button onClick={() => onDelete(tpl.setting_key)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '12px' }}>මකන්න (Delete)</button>
          </div>
          <textarea
            value={tpl.setting_value}
            onChange={(e) => handleChange(tpl.setting_key, e.target.value)}
            style={{ ...inputStyle, height: '60px', fontSize: '13px' }}
            maxLength={1000}
          />
          {fieldNotice[tpl.setting_key] && <FormError>{fieldNotice[tpl.setting_key]}</FormError>}
          <button
            onClick={() => onUpdate(tpl.setting_key, tpl.setting_value)}
            style={{ marginTop: '8px', padding: '5px 15px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >Save Changes</button>
        </div>
      ))}

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8eaf6', borderRadius: '8px', fontSize: '13px', color: '#1a237e' }}>
        💡 <strong>AI Mismatch Threshold:</strong> මෙය වැඩි කිරීමෙන් සුළු ගණනය කිරීමේ වැරදි මඟ හැරිය හැක.
      </div>
    </div>
  );
};

SettingsTab.propTypes = {
  settings: PropTypes.array.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onTriggerDrill: PropTypes.func.isRequired,
};

export default SettingsTab;