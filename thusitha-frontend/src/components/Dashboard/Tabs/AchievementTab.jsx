import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { request, API_URL } from '../../../services/api';

export const SearchableSelect = ({ options, value, onChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const selectedOption = options.find(o => o.value === value);
    if (selectedOption && !isOpen) {
      setSearchTerm(selectedOption.label);
    } else if (!value && !isOpen) {
      setSearchTerm('');
    }
  }, [value, options, isOpen]);

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
      <input
        type="text"
        placeholder="-- ශิෂ්‍යයා සොයන්න (නම හෝ ID) --"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        required={!value}
      />
      {isOpen && (
        <ul style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', 
          maxHeight: '200px', overflowY: 'auto', zIndex: 1000, 
          listStyle: 'none', padding: 0, margin: 0, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
        }}>
          {filteredOptions.length > 0 ? filteredOptions.map(o => (
            <li 
              key={o.value} 
              onMouseDown={(e) => {
                e.preventDefault(); // Prevents input blur from closing dropdown before selection is made
                onChange(o.value);
                setSearchTerm(o.label);
                setIsOpen(false);
              }}
              style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              {o.label}
            </li>
          )) : (
            <li style={{ padding: '10px', color: '#999' }}>ශිෂ්‍යයන් හමුවූයේ නැත</li>
          )}
        </ul>
      )}
    </div>
  );
};

SearchableSelect.propTypes = {
  options: PropTypes.array.isRequired,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired
};

const AchievementTab = ({ students }) => {
  const [achievements, setAchievements] = useState([]);
  const [formData, setFormData] = useState({ 
    student_id: '', 
    title: '', 
    description: '', 
    island_rank: '', 
    achieved_year: new Date().getFullYear() 
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = useRef(null);

  const fetchAchievements = async () => {
    try {
      const data = await request('/achievements');
      setAchievements(data);
    } catch (err) {
      console.error('Failed to fetch achievements', err);
    }
  };

  useEffect(() => { fetchAchievements(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('student_id', formData.student_id);
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('island_rank', formData.island_rank || '');
      data.append('achieved_year', formData.achieved_year);
      if (selectedFile) {
        data.append('photo', selectedFile);
      }

      if (editingId) {
        const currentAch = achievements.find(a => a.achievement_id === editingId);
        if (currentAch && currentAch.image_url) {
          data.append('image_url', currentAch.image_url);
        }
        await request(`/achievements/${editingId}`, { method: 'PUT', body: data, isFormData: true });
      } else {
        await request('/achievements', { method: 'POST', body: data, isFormData: true });
      }
      setFormData({ student_id: '', title: '', description: '', island_rank: '', achieved_year: new Date().getFullYear() });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setEditingId(null);
      fetchAchievements();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleEdit = (a) => {
    setFormData({ 
      student_id: a.student_id, 
      title: a.title, 
      description: a.description || '', 
      island_rank: a.island_rank || '', 
      achieved_year: a.achieved_year 
    });
    setEditingId(a.achievement_id);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id) => {
    if (!globalThis.confirm('Are you sure?')) return;
    try {
      await request(`/achievements/${id}`, { method: 'DELETE' });
      fetchAchievements();
    } catch (err) { alert('Error: ' + err.message); }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: '#1a237e', marginBottom: '20px' }}>🏆 ශිෂ්‍ය ජයග්‍රහණ කළමනාකරණය (Achievements)</h2>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ marginTop: 0, marginBottom: '15px' }}>{editingId ? 'ජයග්‍රහණය සංස්කරණය කරන්න' : 'නව ජයග්‍රහණයක් ඇතුළත් කරන්න'}</h4>
        
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍යයා තෝරන්න (Search Student)</label>
        <SearchableSelect 
          options={students?.map(s => ({ value: s._id, label: `${s.name} (${s.studentId})` })) || []}
          value={formData.student_id}
          onChange={(val) => setFormData({...formData, student_id: val})}
        />

        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ජයග්‍රහණය (Title)</label>
        <input 
          type="text" 
          placeholder="උදා: A/L Biology - Island 1st" 
          value={formData.title} 
          onChange={e => setFormData({...formData, title: e.target.value})} 
          required 
          style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
        />

        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>විස්තරය (Description)</label>
        <textarea 
          placeholder="වැඩිදුර විස්තර..." 
          value={formData.description} 
          onChange={e => setFormData({...formData, description: e.target.value})} 
          style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px', boxSizing: 'border-box' }} 
        />

        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ජයග්‍රහණ ඡායාරූපය (Photo - Optional)</label>
        <input 
          type="file" 
          accept="image/*"
          ref={fileInputRef}
          onChange={e => setSelectedFile(e.target.files[0])}
          style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>දිවයිනේ ස්ථානය (Rank - Optional)</label>
            <input 
              type="number" 
              placeholder="Island Rank" 
              value={formData.island_rank} 
              onChange={e => setFormData({...formData, island_rank: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>වසර (Year)</label>
            <input 
              type="number" 
              placeholder="Year" 
              value={formData.achieved_year} 
              onChange={e => setFormData({...formData, achieved_year: e.target.value})} 
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            {editingId ? '💾 යාවත්කාලීන කරන්න' : '🏆 ජයග්‍රහණය ඇතුළත් කරන්න'}
          </button>
          {(editingId || selectedFile) && (
            <button 
              type="button" 
              onClick={() => { 
                setEditingId(null); 
                setFormData({student_id: '', title: '', description: '', island_rank: '', achieved_year: new Date().getFullYear()}); 
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }} 
              style={{ padding: '12px 24px', backgroundColor: '#757575', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              අවලංගු කරන්න
            </button>
          )}
        </div>
      </form>
      
      <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>පද්ධතියේ ඇති ජයග්‍රහණ</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ශිෂ්‍යයා</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>ඡායාරූපය (Photo)</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ජයග්‍රහණය</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ස්ථානය / වසර</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>ක්‍රියාමාර්ග</th>
            </tr>
          </thead>
          <tbody>
            {achievements.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '15px', textAlign: 'center', color: '#666' }}>දැනට ජයග්‍රහණ කිසිවක් නොමැත.</td></tr>
            ) : achievements.map(a => (
              <tr key={a.achievement_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{a.student_name}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {a.image_url ? (
                    <img
                      src={`${API_URL}/${a.image_url.replace(/\\/g, '/')}`}
                      alt={a.title} 
                      style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #ddd', display: 'block', margin: '0 auto' }}
                    />
                  ) : (
                    <span style={{ color: '#ccc' }}>N/A</span>
                  )}
                </td>
                <td style={{ padding: '12px' }}>{a.title}</td>
                <td style={{ padding: '12px' }}>
                  {a.island_rank ? <span style={{ color: '#f57c00', fontWeight: 'bold', marginRight: '5px' }}>Rank {a.island_rank}</span> : null}
                  <span style={{ color: '#666' }}>({a.achieved_year})</span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(a)} style={{ padding: '6px 12px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', marginRight: '8px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDelete(a.achievement_id)} style={{ padding: '6px 12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

AchievementTab.propTypes = {
  students: PropTypes.array.isRequired
};

export default AchievementTab;
