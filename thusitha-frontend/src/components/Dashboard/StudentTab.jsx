import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { getImageUrl } from '../../services/api';
import FormError from '../common/FormError';
import {
  filterNameInput, filterPhoneInput, filterTextInput,
  NAME_INVALID_MSG, PHONE_INVALID_MSG, TEXT_INVALID_MSG,
  validateName, validatePhone, validateText,
} from '../../utils/formValidation';
import { useFieldValidation } from '../../utils/useFieldValidation';
import { canIssueIdCard } from '../../utils/studentGrade';

const thSticky = { position: 'sticky', top: 0, backgroundColor: '#f5f5f5', zIndex: 1 };


const StudentTab = ({ students, courses = [], onAddClick, onEditClick, onDeleteClick, onEncode, onUploadPhoto, onDownloadIDCard, role }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editFormData, setEditFormData] = useState({ student_name: '', school: '', grade: '', parent_name: '', parent_phone: '', address: '' });

  const canEdit = role === 'Admin' || role === 'Counter Person';
  const canDelete = role === 'Admin';

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(student.studentId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourseId === '' ||
      (student.courseIds && student.courseIds.includes(Number(selectedCourseId)));
    return matchesSearch && matchesCourse;
  });

  const processDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await onDeleteClick(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Error deleting student:', err);
    }
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setEditFormData({
      student_name: student.name || '',
      school: student.email || '',
      grade: student.grade || '',
      parent_name: student.parentName || '',
      parent_phone: student.parentPhone || '',
      address: student.address || ''
    });
  };

  const editRules = (d) => ({
    student_name: () => validateName(d.student_name, { label: 'ශිෂ්‍යයාගේ නම' }),
    school: () => validateText(d.school, { label: 'පාසල', max: 150 }),
    grade: () => validateText(d.grade, { label: 'ශ්‍රේණිය', max: 30 }),
    parent_name: () => validateName(d.parent_name, { required: false, label: 'දෙමාපිය නම' }),
    parent_phone: () => validatePhone(d.parent_phone, { required: false }),
    address: () => validateText(d.address, { label: 'ලිපිනය', max: 300 }),
  });
  const ev = useFieldValidation(editFormData, setEditFormData, editRules, {
    student_name: 'edit-name', school: 'edit-school', grade: 'edit-grade',
    parent_name: 'edit-parent-name', parent_phone: 'edit-parent-phone', address: 'edit-address',
  });
  const closeEdit = () => { setEditingStudent(null); ev.clear(); };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!ev.validateAll()) return;
    try {
      await onEditClick(editingStudent._id, editFormData);
      closeEdit();
    } catch (err) {
      console.error('Error editing student:', err);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: '#1a237e', margin: 0 }}>🧑‍🎓 සැබෑ ශිෂ්‍ය ලේඛනය</h3>
        {canEdit && (
          <button
            type="button"
            onClick={onAddClick}
            style={{ padding: '10px 15px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ➕ අලුත් ශිෂ්‍යයෙක් එකතු කරන්න
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div>
          <input
            type="text"
            placeholder="නමින් හෝ ශිෂ්‍ය අංකයෙන් සොයන්න..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          >
            <option value="">-- පන්තිය අනුව පෙරන්න (Filter by Class) --</option>
            {courses.map(course => (
              <option key={course.course_id} value={course.course_id}>
                {course.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ~10 rows visible; the rest scroll inside the box (header stays pinned) */}
      <div style={{ maxHeight: 'max(300px, calc(100vh - 330px))', overflowY: 'auto', overflowX: 'auto', marginTop: '15px', border: '1px solid #e3e6f0', borderRadius: '10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ ...thSticky, padding: '12px' }}>Student ID</th>
            <th style={{ ...thSticky, padding: '12px', textAlign: 'center' }}>ඡායාරූපය (Photo)</th>
            <th style={{ ...thSticky, padding: '12px' }}>නම</th>
            <th style={{ ...thSticky, padding: '12px' }}>පාසල</th>
            <th style={{ ...thSticky, padding: '12px', textAlign: 'center' }}>AI Biometrics</th>
            <th style={{ ...thSticky, padding: '12px' }}>මව්පියන්ගේ නම / දුරකථනය</th>
            {(canEdit || canDelete) && <th style={{ ...thSticky, padding: '12px' }}>ක්‍රියාමාර්ග</th>}
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length === 0 && <tr><td colSpan={canEdit ? "7" : "6"} style={{ textAlign: 'center', padding: '20px' }}>ශිෂ්‍යයන් හමුවුණේ නැත.</td></tr>}
          {filteredStudents.map((student, index) => (
            <tr key={student._id || index} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>{student.studentId}</td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                {student.hasPhoto ? (
                  <img
                    src={getImageUrl(student.photoPath)}
                    alt={student.name}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #ddd', display: 'block', margin: '0 auto' }}
                  />
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '16px', color: '#888' }}>
                    👤
                  </div>
                )}
              </td>
              <td style={{ padding: '12px' }}>{student.name}</td>
              <td style={{ padding: '12px' }}>{student.email}</td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <span title={student.hasEncoding ? "Face Encoded" : "No Biometric Data"} style={{ fontSize: '18px' }}>
                  {student.hasEncoding ? '🛡️' : '🔘'}
                </span>
              </td>
              <td style={{ padding: '12px' }}>
                {student.parentName}
                {student.parentPhone && student.parentPhone !== 'N/A' && (
                  <span style={{ display: 'block', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    📞 {student.parentPhone}
                  </span>
                )}
              </td>
              {(canEdit || canDelete) && (
                <td style={{ padding: '12px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {canEdit && (
                    <button
                      onClick={() => openEditModal(student)}
                      style={{ padding: '5px 10px', backgroundColor: '#ffd600', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      සංස්කරණය
                    </button>
                  )}
                  {canEdit && (
                    <label style={{ padding: '5px 10px', backgroundColor: '#00b0ff', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>
                      📷 Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            onUploadPhoto(student._id, e.target.files[0]);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                  {student.hasPhoto && canEdit && (
                    <button
                      onClick={() => onEncode(student._id)}
                      style={{ padding: '5px 10px', backgroundColor: student.hasEncoding ? '#2e7d32' : '#455a64', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      {student.hasEncoding ? '🔄 Re-encode' : '⚙️ AI Encode'}
                    </button>
                  )}
                  {canIssueIdCard(student) && (
                    <button
                      onClick={() => onDownloadIDCard(student)}
                      title={`ශ්‍රේණිය: ${student.grade || 'නොදනී'}`}
                      style={{ padding: '5px 10px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >🆔 ID Card</button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setConfirmDeleteId(student._id)}
                      style={{ padding: '5px 10px', backgroundColor: '#ff1744', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      ඉවත් කරන්න
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '40px', color: '#d32f2f', marginBottom: '15px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#1a237e' }}>ශිෂ්‍යයා ඉවත් කිරීම ස්ථිරද?</h3>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
              මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. මෙම ශිෂ්‍යයාට අදාළ පැමිණීමේ වාර්තා සහ ගෙවීම් දත්ත ද මෙහිදී මැකී යනු ඇත.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '25px' }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '10px', border: '1px solid #ccc', background: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>අවලංගු කරන්න</button>
              <button onClick={processDelete} style={{ flex: 1, padding: '10px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>ඔව්, ඉවත් කරන්න</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Student Modal */}
      {editingStudent && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1a237e', textAlign: 'center' }}>✏️ ශිෂ්‍ය දත්ත සංස්කරණය</h3>
            <form onSubmit={handleEditSubmit} noValidate>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="edit-name" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ශිෂ්‍යයාගේ නම</label>
                <input id="edit-name" type="text" placeholder="උදා: කමල් පෙරේරා (e.g. Kamal Perera)" maxLength={150} value={editFormData.student_name} onChange={(e) => ev.set('student_name', e.target.value, filterNameInput, NAME_INVALID_MSG)} onBlur={() => ev.blur('student_name')} style={{ ...{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }, ...(ev.errors.student_name ? { border: '1px solid #d32f2f' } : {}) }} />
                <FormError>{ev.errors.student_name}</FormError>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="edit-school" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>පාසල</label>
                <input id="edit-school" type="text" placeholder="උදා: රාජකීය විද්‍යාලය (e.g. Royal College)" maxLength={150} value={editFormData.school} onChange={(e) => ev.set('school', e.target.value, filterTextInput, TEXT_INVALID_MSG)} onBlur={() => ev.blur('school')} style={{ ...{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }, ...(ev.errors.school ? { border: '1px solid #d32f2f' } : {}) }} />
                <FormError>{ev.errors.school}</FormError>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="edit-grade" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ශ්‍රේණිය</label>
                <input id="edit-grade" type="text" placeholder="උදා: Grade 12 (12-AL)" maxLength={30} value={editFormData.grade} onChange={(e) => ev.set('grade', e.target.value, filterTextInput, TEXT_INVALID_MSG)} onBlur={() => ev.blur('grade')} style={{ ...{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }, ...(ev.errors.grade ? { border: '1px solid #d32f2f' } : {}) }} />
                <FormError>{ev.errors.grade}</FormError>
              </div>
              {/* Parent Information */}
              <div style={{ padding: '12px', backgroundColor: '#e8eaf6', borderRadius: '8px', marginBottom: '15px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a237e', marginBottom: '10px' }}>👨‍👩‍👦 දෙමාපිය / භාරකාර තොරතුරු</div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="edit-parent-name" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>දෙමාපිය නම</label>
                  <input id="edit-parent-name" type="text" maxLength={150} value={editFormData.parent_name} onChange={(e) => ev.set('parent_name', e.target.value, filterNameInput, NAME_INVALID_MSG)} onBlur={() => ev.blur('parent_name')} style={{ ...{ width: '100%', padding: '9px', borderRadius: '5px', border: '1px solid #c5cae9', boxSizing: 'border-box', fontSize: '14px' }, ...(ev.errors.parent_name ? { border: '1px solid #d32f2f' } : {}) }} placeholder="උදා: සුනිල් පෙරේරා (e.g. Sunil Perera)" />
                  <FormError>{ev.errors.parent_name}</FormError>
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label htmlFor="edit-parent-phone" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>📞 WhatsApp දුරකථන අංකය</label>
                  <input id="edit-parent-phone" type="tel" inputMode="numeric" maxLength={12} value={editFormData.parent_phone} onChange={(e) => ev.set('parent_phone', e.target.value, filterPhoneInput, PHONE_INVALID_MSG)} onBlur={() => ev.blur('parent_phone')} style={{ ...{ width: '100%', padding: '9px', borderRadius: '5px', border: '1px solid #c5cae9', boxSizing: 'border-box', fontSize: '14px' }, ...(ev.errors.parent_phone ? { border: '1px solid #d32f2f' } : {}) }} placeholder="උදා: 0771234567 හෝ +94771234567" />
                  <FormError>{ev.errors.parent_phone}</FormError>
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="edit-address" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ලිපිනය</label>
                <input id="edit-address" type="text" maxLength={300} value={editFormData.address} onChange={(e) => ev.set('address', e.target.value, filterTextInput, TEXT_INVALID_MSG)} onBlur={() => ev.blur('address')} style={{ ...{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }, ...(ev.errors.address ? { border: '1px solid #d32f2f' } : {}) }} placeholder="උදා: නො: 12, මහනුවර පාර, කොළඹ" />
                <FormError>{ev.errors.address}</FormError>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={closeEdit} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'none', borderRadius: '6px', cursor: 'pointer' }}>අවලංගු කරන්න</button>
                <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💾 සුරකින්න</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

StudentTab.propTypes = {
  students: PropTypes.array.isRequired,
  courses: PropTypes.array,
  onAddClick: PropTypes.func,
  onEditClick: PropTypes.func,
  onDeleteClick: PropTypes.func,
  onEncode: PropTypes.func,
  onUploadPhoto: PropTypes.func,
  onDownloadIDCard: PropTypes.func,
  role: PropTypes.string,
};

StudentTab.defaultProps = {
  courses: [],
  onAddClick: () => { },
  onEditClick: () => { },
  onDeleteClick: () => { },
  onEncode: () => { },
  onUploadPhoto: () => { },
  onDownloadIDCard: () => { },
  role: 'Teacher',
};

export default StudentTab;