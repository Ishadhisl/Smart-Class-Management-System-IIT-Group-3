import React, { useState, useEffect } from 'react';
import { request } from '../../../services/api';
import FormError from '../../common/FormError';
import { filterTextInput, TEXT_INVALID_MSG, validateText } from '../../../utils/formValidation';
import { useFieldValidation } from '../../../utils/useFieldValidation';

const baseInput = { display: 'block', width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' };
const errInput = (msg, extra = {}) => ({ ...baseInput, ...extra, ...(msg ? { border: '1px solid #d32f2f', marginBottom: '4px' } : {}) });

const AnnouncementTab = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [formData, setFormData] = useState({ title: '', body: '', is_active: true });
  const [editingId, setEditingId] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      const data = await request('/announcements');
      setAnnouncements(data);
    } catch (err) {
      console.error('Failed to fetch announcements', err);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const rules = (d) => ({
    title: () => validateText(d.title, { required: true, label: 'මාතෘකාව', min: 3, max: 150 }),
    body: () => validateText(d.body, { required: true, label: 'විස්තරය', min: 5, max: 2000 }),
  });
  const v = useFieldValidation(formData, setFormData, rules, { title: 'announcement-title', body: 'announcement-body' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    try {
      if (editingId) {
        await request(`/announcements/${editingId}`, { method: 'PUT', body: formData });
      } else {
        await request('/announcements', { method: 'POST', body: formData });
      }
      setFormData({ title: '', body: '', is_active: true });
      v.clear();
      setEditingId(null);
      fetchAnnouncements();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleEdit = (a) => {
    setFormData({ title: a.title, body: a.body, is_active: a.is_active });
    setEditingId(a.announcement_id);
  };

  const handleDelete = async (id) => {
    if (!globalThis.confirm('Are you sure?')) return;
    try {
      await request(`/announcements/${id}`, { method: 'DELETE' });
      fetchAnnouncements();
    } catch (err) { alert('Error: ' + err.message); }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: '#1a237e', marginBottom: '20px' }}>නිවේදන කළමනාකරණය (Announcements)</h2>
      
      <form onSubmit={handleSubmit} noValidate style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ marginTop: 0, marginBottom: '15px' }}>{editingId ? 'නිවේදනය සංස්කරණය කරන්න' : 'නව නිවේදනයක් පළ කරන්න'}</h4>
        <input
          id="announcement-title"
          type="text"
          placeholder="උදා: පෝය දින නිවාඩුව (නිවේදනයේ මාතෘකාව) *"
          maxLength={150}
          value={formData.title}
          onChange={e => v.set('title', e.target.value, filterTextInput, TEXT_INVALID_MSG)}
          onBlur={() => v.blur('title')}
          style={errInput(v.errors.title)}
        />
        {v.errors.title && <FormError className="mb-3">{v.errors.title}</FormError>}
        <textarea
          id="announcement-body"
          placeholder="උදා: සෑම පෝය දිනකම ආයතනය වසා තැබේ. (විස්තරය) *"
          maxLength={2000}
          value={formData.body}
          onChange={e => v.set('body', e.target.value, filterTextInput, TEXT_INVALID_MSG)}
          onBlur={() => v.blur('body')}
          style={errInput(v.errors.body, { minHeight: '100px' })}
        />
        {v.errors.body && <FormError className="mb-3">{v.errors.body}</FormError>}
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
          <input 
            type="checkbox" 
            checked={formData.is_active} 
            onChange={e => setFormData({...formData, is_active: e.target.checked})} 
            style={{ marginRight: '10px', width: '18px', height: '18px' }} 
          />
          ක්‍රියාකාරීයි (ප්‍රසිද්ධ පිටුවේ පෙන්වන්න)
        </label>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            {editingId ? 'යාවත්කාලීන කරන්න' : 'පළ කරන්න'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={() => { setEditingId(null); setFormData({title: '', body: '', is_active: true}); }} 
              style={{ padding: '12px 24px', backgroundColor: '#757575', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              අවලංගු කරන්න
            </button>
          )}
        </div>
      </form>
      
      <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>පළ කළ නිවේදන</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>මාතෘකාව</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>තත්ත්වය</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>දිනය</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>ක්‍රියාමාර්ග</th>
            </tr>
          </thead>
          <tbody>
            {announcements.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#666' }}>දැනට නිවේදන කිසිවක් නොමැත.</td></tr>
            ) : announcements.map(a => (
              <tr key={a.announcement_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}><strong>{a.title}</strong></td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: a.is_active ? '#e8f5e9' : '#ffebee', color: a.is_active ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                    {a.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#666' }}>{new Date(a.posted_at).toLocaleString()}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(a)} style={{ padding: '6px 12px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', marginRight: '8px', cursor: 'pointer' }}>සංස්කරණය</button>
                  <button onClick={() => handleDelete(a.announcement_id)} style={{ padding: '6px 12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>ඉවත් කරන්න</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnnouncementTab;
