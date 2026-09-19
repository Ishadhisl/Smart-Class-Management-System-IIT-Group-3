import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { API_URL } from '../../services/api';
import { filterNameInput, filterPhoneInput, filterWithFeedback, NAME_INVALID_MSG, PHONE_INVALID_MSG, validateName, validateEmail, validatePhone, validateRequired } from '../../utils/formValidation';

const TeacherTab = ({ teachers, role, onAdd, onEdit, onDelete }) => {
  const canEdit = role === 'Admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: '', password: '', teacher_name: '', phone: '', email: '', specialization: '', qualifications: '', photo: null
  });
  const [formErrors, setFormErrors] = useState({});
  const errorTextStyle = { color: '#d32f2f', fontSize: '12px', marginTop: '-8px', marginBottom: '10px' };

  const teacherPhotoMap = {
    'ruwan': '/teachers/ruwan.png',
    'sunil': '/teachers/sunil.png',
    'sumeera': '/teachers/sumeera.png',
    'sampath': '/teachers/sampath.png',
    'nimali': '/teachers/nimali.png',
    'namal': '/teachers/namal.png',
    'shanika': '/teachers/shanika.png',
    'thusitha': '/teachers/thusitha.png'
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/teachers/') || path.startsWith('/achievers/') || path.startsWith('/flyers/')) return path;
    const cleanPath = path.replace(/\\/g, '/');
    const prefix = cleanPath.startsWith('/') ? '' : '/';
    return `${API_URL}${prefix}${cleanPath}`;
  };

  const resolveTeacherPhoto = (teacher) => {
    if (teacher.profile_photo_path) return getImageUrl(teacher.profile_photo_path);
    if (teacher.teacher_name) {
       const nameKey = teacher.teacher_name.toLowerCase();
       for (const [key, path] of Object.entries(teacherPhotoMap)) {
         if (nameKey.includes(key) || (teacher.username && teacher.username.toLowerCase().includes(key))) {
           return path;
         }
       }
    }
    return null;
  };

  const filteredTeachers = teachers.filter(t =>
    (t.teacher_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.specialization || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ username: '', password: '', teacher_name: '', phone: '', email: '', specialization: '', qualifications: '', photo: null });
    setFormErrors({});
  };

  const validateAddForm = () => {
    const errors = {
      username: validateRequired(formData.username, 'පරිශීලක නාමය'),
      teacher_name: validateName(formData.teacher_name, { label: 'ගුරුවරයාගේ නම' }),
      phone: validatePhone(formData.phone, { required: false }),
      email: formData.email ? validateEmail(formData.email, { required: false }) : '',
    };
    setFormErrors(errors);
    return Object.values(errors).every((msg) => !msg);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateAddForm()) return;
    setIsSubmitting(true);
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          form.append(key, formData[key]);
        }
      });
      await onAdd(form);
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '' && key !== 'username' && key !== 'password') {
          form.append(key, formData[key]);
        }
      });
      await onEdit(editingTeacher.teacher_id, form);
      setEditingTeacher(null);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const processDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await onDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      username: '', password: '',
      teacher_name: teacher.teacher_name || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      specialization: teacher.specialization || '',
      qualifications: teacher.qualifications || '',
      photo: null
    });
  };

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box', marginBottom: '12px' };
  const invalidInputStyle = { ...inputStyle, border: '1px solid #d32f2f', marginBottom: '4px' };
  const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' };

  const renderForm = (isEdit) => (
    <form onSubmit={isEdit ? handleEdit : handleAdd}>
      {!isEdit && (
        <div>
          <label htmlFor="teacher-username" style={labelStyle}>පරිශීලක නාමය (Login Username) *</label>
          <input id="teacher-username" type="text" value={formData.username}
            required maxLength={100} pattern="[A-Za-z0-9._\- ]+" title="අකුරු, ඉලක්කම්, . _ - space විතරක් යොදන්න"
            style={formErrors.username ? invalidInputStyle : inputStyle} placeholder="teacher01"
            onChange={(e) => {
              setFormData({...formData, username: e.target.value});
              if (formErrors.username) setFormErrors({ ...formErrors, username: validateRequired(e.target.value, 'පරිශීලක නාමය') });
            }}
            onBlur={(e) => setFormErrors({ ...formErrors, username: validateRequired(e.target.value, 'පරිශීලක නාමය') })}
          />
          {formErrors.username && <div style={errorTextStyle}>{formErrors.username}</div>}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '-6px', marginBottom: '12px' }}>
            ආරම්භක මුරපදය: <b>Teacher@123</b> — ගුරුවරයාට පළමු වර log වී මුරපදය වෙනස් කළ හැක.
          </div>
        </div>
      )}
      <div>
        <label htmlFor="teacher-name" style={labelStyle}>ගුරුවරයාගේ නම *</label>
        <input id="teacher-name" type="text" value={formData.teacher_name}
          required maxLength={150} style={formErrors.teacher_name ? invalidInputStyle : inputStyle} placeholder="Mr. Perera"
          onChange={(e) => {
            const { filtered, invalidAttempt } = filterWithFeedback(e.target.value, filterNameInput);
            setFormData({...formData, teacher_name: filtered});
            setFormErrors({ ...formErrors, teacher_name: invalidAttempt ? NAME_INVALID_MSG : (formErrors.teacher_name ? validateName(filtered, { label: 'ගුරුවරයාගේ නම' }) : '') });
          }}
          onBlur={(e) => setFormErrors({ ...formErrors, teacher_name: validateName(e.target.value, { label: 'ගුරුවරයාගේ නම' }) })}
        />
        {formErrors.teacher_name && <div style={errorTextStyle}>{formErrors.teacher_name}</div>}
      </div>
      <div>
        <label htmlFor="teacher-phone" style={labelStyle}>දුරකථන අංකය</label>
        <input id="teacher-phone" type="tel" value={formData.phone}
          pattern="(?:\+94|0)7[0-9]{8}" title="උදා: 0771234567 හෝ +94771234567" style={formErrors.phone ? invalidInputStyle : inputStyle} placeholder="0771234567"
          onChange={(e) => {
            const { filtered, invalidAttempt } = filterWithFeedback(e.target.value, filterPhoneInput);
            setFormData({...formData, phone: filtered});
            setFormErrors({ ...formErrors, phone: invalidAttempt ? PHONE_INVALID_MSG : (formErrors.phone ? validatePhone(filtered, { required: false }) : '') });
          }}
          onBlur={(e) => setFormErrors({ ...formErrors, phone: validatePhone(e.target.value, { required: false }) })}
        />
        {formErrors.phone && <div style={errorTextStyle}>{formErrors.phone}</div>}
      </div>
      <div>
        <label htmlFor="teacher-email" style={labelStyle}>ඊමේල්</label>
        <input id="teacher-email" type="email" value={formData.email}
          maxLength={150} style={formErrors.email ? invalidInputStyle : inputStyle} placeholder="teacher@example.com"
          onChange={(e) => {
            setFormData({...formData, email: e.target.value});
            if (formErrors.email) setFormErrors({ ...formErrors, email: validateEmail(e.target.value, { required: false }) });
          }}
          onBlur={(e) => setFormErrors({ ...formErrors, email: validateEmail(e.target.value, { required: false }) })}
        />
        {formErrors.email && <div style={errorTextStyle}>{formErrors.email}</div>}
      </div>
      <div>
        <label htmlFor="teacher-spec" style={labelStyle}>විෂය / විශේෂත්වය</label>
        <input id="teacher-spec" type="text" value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} maxLength={150} style={inputStyle} placeholder="Combined Mathematics" />
      </div>
      <div>
        <label htmlFor="teacher-qual" style={labelStyle}>සුදුසුකම්</label>
        <input id="teacher-qual" type="text" value={formData.qualifications} onChange={(e) => setFormData({...formData, qualifications: e.target.value})} maxLength={300} style={inputStyle} placeholder="B.Sc, M.Sc" />
      </div>
      <div>
        <label htmlFor="teacher-photo" style={labelStyle}>ඡායාරූපය (Photo)</label>
        <input id="teacher-photo" type="file" accept="image/*" onChange={(e) => setFormData({...formData, photo: e.target.files && e.target.files[0] ? e.target.files[0] : null})} style={{ ...inputStyle, padding: '5px' }} />
        {isEdit && editingTeacher?.profile_photo_path && (
          <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
            දැනට ඇති ඡායාරූපය: <img src={getImageUrl(editingTeacher.profile_photo_path)} alt="Current" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%', verticalAlign: 'middle', marginLeft: '10px' }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
        <button type="button" disabled={isSubmitting} onClick={() => { isEdit ? setEditingTeacher(null) : setShowAddModal(false); resetForm(); }} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'none', borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}>අවලංගු කරන්න</button>
        <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isSubmitting ? 0.6 : 1 }}>{isSubmitting ? '⏳ සුරකිමින්...' : '💾 සුරකින්න'}</button>
      </div>
    </form>
  );

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: '#1a237e', margin: 0 }}>👨‍🏫 ගුරු ලේඛනය</h3>
        {canEdit && (
          <button type="button" onClick={() => setShowAddModal(true)} style={{ padding: '10px 15px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            ➕ අලුත් ගුරුවරයෙක් එකතු කරන්න
          </button>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input type="text" placeholder="නමින්, ඊමේල්, හෝ විෂයෙන් සොයන්න..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '16px' }}>ID</th>
            <th style={{ padding: '16px' }}>ඡායාරූපය</th>
            <th style={{ padding: '16px' }}>නම</th>
            <th style={{ padding: '16px' }}>දුරකථන</th>
            <th style={{ padding: '16px' }}>ඊමේල්</th>
            <th style={{ padding: '16px' }}>විෂය</th>
            <th style={{ padding: '16px' }}>සුදුසුකම්</th>
            {canEdit && <th style={{ padding: '16px' }}>ක්‍රියාමාර්ග</th>}
          </tr>
        </thead>
        <tbody>
          {filteredTeachers.length === 0 && (
            <tr><td colSpan={canEdit ? "8" : "7"} style={{ textAlign: 'center', padding: '20px' }}>ගුරුවරුන් හමුවුණේ නැත.</td></tr>
          )}
          {filteredTeachers.map((teacher, index) => (
            <tr key={teacher.teacher_id || index} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '16px', fontWeight: 'bold' }}>{teacher.teacher_id}</td>
              <td style={{ padding: '16px' }}>
                {resolveTeacherPhoto(teacher) ? (
                  <img src={resolveTeacherPhoto(teacher)} alt="Teacher" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                ) : null}
                <div style={{ display: resolveTeacherPhoto(teacher) ? 'none' : 'flex', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👨‍🏫</div>
              </td>
              <td style={{ padding: '16px' }}>{teacher.teacher_name}</td>
              <td style={{ padding: '16px' }}>{teacher.phone || 'N/A'}</td>
              <td style={{ padding: '16px' }}>{teacher.email || 'N/A'}</td>
              <td style={{ padding: '16px' }}>{teacher.specialization || 'N/A'}</td>
              <td style={{ padding: '16px' }}>{teacher.qualifications || 'N/A'}</td>
              {canEdit && (
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => openEditModal(teacher)} style={{ padding: '5px 10px', backgroundColor: '#ffd600', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>සංස්කරණය</button>
                    <button onClick={() => setConfirmDeleteId(teacher.teacher_id)} style={{ padding: '5px 10px', backgroundColor: '#ff1744', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>ඉවත් කරන්න</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Teacher Modal */}
      {showAddModal && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '60px', paddingBottom: '60px', overflowY: 'auto', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1a237e', textAlign: 'center' }}>➕ අලුත් ගුරුවරයෙක් එකතු කිරීම</h3>
            {renderForm(false)}
          </div>
        </div>,
        document.body
      )}

      {/* Edit Teacher Modal */}
      {editingTeacher && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '60px', paddingBottom: '60px', overflowY: 'auto', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1a237e', textAlign: 'center' }}>✏️ ගුරු දත්ත සංස්කරණය</h3>
            {renderForm(true)}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '40px', color: '#d32f2f', marginBottom: '15px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#1a237e' }}>ගුරුවරයා ඉවත් කිරීම ස්ථිරද?</h3>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>මෙම ක්‍රියාව ආපසු හැරවිය නොහැක.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '25px' }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '10px', border: '1px solid #ccc', background: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>අවලංගු කරන්න</button>
              <button onClick={processDelete} style={{ flex: 1, padding: '10px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>ඔව්, ඉවත් කරන්න</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

TeacherTab.propTypes = {
  teachers: PropTypes.array.isRequired,
  role: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default TeacherTab;
