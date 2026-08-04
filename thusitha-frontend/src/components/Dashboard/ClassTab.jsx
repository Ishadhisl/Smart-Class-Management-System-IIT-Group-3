import React, { useState } from 'react';
import PropTypes from 'prop-types';

const ClassTab = ({ 
  courses, lecturers, subjects, halls, classSchedules, 
  onCreateClass, onUpdateClass, onDeleteClass,
  onCreateCourse, onUpdateCourse, onDeleteCourse,
  onCreateSubject, onUpdateSubject, onDeleteSubject,
  onCreateHall, onUpdateHall, onDeleteHall
}) => {
  const [activeSubTab, setActiveSubTab] = useState('schedules');
  const [formData, setFormData] = useState({
    course_id: '',
    subject_id: '',
    lecturer_id: '',
    hall_id: '',
    day_of_week: [],
    start_time: '',
    end_time: '',
    class_name: '',
    capacity: ''
  });
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // New states for sub-tabs
  const [newCourse, setNewCourse] = useState({ course_name: '', monthly_fee: '', teacher_id: '', subject_id: '' });
  const [editingCourseId, setEditingCourseId] = useState(null);
  
  const [newSubject, setNewSubject] = useState({ subject_name: '', description: '' });
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  
  const [newHall, setNewHall] = useState({ hall_name: '', capacity: '' });
  const [editingHallId, setEditingHallId] = useState(null);

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    if (editingCourseId) {
      await onUpdateCourse(editingCourseId, newCourse);
      setEditingCourseId(null);
    } else {
      await onCreateCourse(newCourse);
    }
    setNewCourse({ course_name: '', monthly_fee: '', teacher_id: '', subject_id: '' });
  };

  const handleEditCourseClick = (course) => {
    setEditingCourseId(course.course_id);
    setNewCourse({
      course_name: course.course_name || '',
      monthly_fee: course.monthly_fee || '',
      teacher_id: course.teacher_id || '',
      subject_id: course.subject_id || ''
    });
  };

  const handleSubmitSubject = async (e) => {
    e.preventDefault();
    if (editingSubjectId) {
      await onUpdateSubject(editingSubjectId, newSubject);
      setEditingSubjectId(null);
    } else {
      await onCreateSubject(newSubject);
    }
    setNewSubject({ subject_name: '', description: '' });
  };

  const handleEditSubjectClick = (subject) => {
    setEditingSubjectId(subject.subject_id);
    setNewSubject({
      subject_name: subject.subject_name || '',
      description: subject.description || ''
    });
  };

  const handleSubmitHall = async (e) => {
    e.preventDefault();
    if (editingHallId) {
      await onUpdateHall(editingHallId, newHall);
      setEditingHallId(null);
    } else {
      await onCreateHall(newHall);
    }
    setNewHall({ hall_name: '', capacity: '' });
  };

  const handleEditHallClick = (hall) => {
    setEditingHallId(hall.hall_id);
    setNewHall({
      hall_name: hall.hall_name || '',
      capacity: hall.capacity || ''
    });
  };

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleDayChange = (day) => {
    setFormData(prev => ({
      ...prev,
      day_of_week: prev.day_of_week.includes(day)
        ? prev.day_of_week.filter(d => d !== day)
        : [...prev.day_of_week, day]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingScheduleId) {
      await onUpdateClass(editingScheduleId, formData);
      setEditingScheduleId(null);
    } else {
      await onCreateClass(formData);
    }
    // Reset form after submission
    setFormData({
      course_id: '',
      subject_id: '',
      lecturer_id: '',
      hall_id: '',
      day_of_week: [],
      start_time: '',
      end_time: '',
      class_name: '',
      capacity: ''
    });
  };

  const handleEditClick = (schedule) => {
    setEditingScheduleId(schedule.schedule_id);
    setFormData({
      course_id: schedule.course_id || '',
      subject_id: schedule.subject_id || '',
      lecturer_id: schedule.lecturer_id || '',
      hall_id: schedule.hall_id || '',
      day_of_week: Array.isArray(schedule.day_of_week) ? schedule.day_of_week : [],
      start_time: schedule.start_time || '',
      end_time: schedule.end_time || '',
      class_name: schedule.class_name || '',
      capacity: schedule.capacity || ''
    });
  };

  const processDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await onDeleteClass(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Error deleting class schedule:', err);
      // Notification handled by Dashboard
    }
  };

  const filteredSchedules = (classSchedules || []).filter(schedule => {
    const className = schedule.class_name || '';
    const courseName = schedule.course_name || '';
    const lecturerName = schedule.lecturer_name || '';
    const hallName = schedule.hall_name || '';
    return (
      className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lecturerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hallName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' };

  const tabStyle = (isActive) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    borderBottom: isActive ? '3px solid #1a237e' : '3px solid transparent',
    color: isActive ? '#1a237e' : '#666',
    fontWeight: isActive ? 'bold' : 'normal',
    backgroundColor: 'transparent',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    fontSize: '16px'
  });

  return (
    <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '10px' }}>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button style={tabStyle(activeSubTab === 'schedules')} onClick={() => setActiveSubTab('schedules')}>🗓️ කාලසටහන්</button>
        <button style={tabStyle(activeSubTab === 'courses')} onClick={() => setActiveSubTab('courses')}>🎓 පන්ති</button>
        <button style={tabStyle(activeSubTab === 'subjects')} onClick={() => setActiveSubTab('subjects')}>📚 විෂයයන්</button>
        <button style={tabStyle(activeSubTab === 'halls')} onClick={() => setActiveSubTab('halls')}>🏢 ශාලා</button>
      </div>

      {activeSubTab === 'schedules' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      {/* LEFT: Create Class Form */}
      <div style={{ flex: 1, minWidth: '400px', backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#1a237e', margin: 0 }}>
            {editingScheduleId ? '🔄 කාලසටහන සංස්කරණය' : '📚 නව පන්ති කාලසටහනක්'}
          </h3>
          {editingScheduleId && (
            <button onClick={() => { setEditingScheduleId(null); setFormData({ course_id: '', subject_id: '', lecturer_id: '', hall_id: '', day_of_week: [], start_time: '', end_time: '', class_name: '', capacity: '' }); }} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>අවලංගු කරන්න</button>
          )}
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="className" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තියේ නම</label>
          <input id="className" type="text" placeholder="Grade 11 Science - Batch A" style={inputStyle} value={formData.class_name} onChange={(e) => setFormData({...formData, class_name: e.target.value})} required />

          <label htmlFor="courseSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තිය</label>
          <select id="courseSelect" style={inputStyle} value={formData.course_id} onChange={(e) => setFormData({...formData, course_id: e.target.value})} required>
            <option value="">-- පන්තියක් තෝරන්න --</option>
            {courses.map((c, idx) => <option key={c.course_id || idx} value={c.course_id}>{c.course_name}</option>)}
          </select>

          <label htmlFor="subjectSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>විෂය</label>
          <select id="subjectSelect" style={inputStyle} value={formData.subject_id} onChange={(e) => setFormData({...formData, subject_id: e.target.value})} required>
            <option value="">-- විෂයක් තෝරන්න --</option>
            {subjects.map((s, idx) => <option key={s.subject_id || idx} value={s.subject_id}>{s.subject_name}</option>)}
          </select>

          <label htmlFor="lecturerSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>දේශකයා</label>
          <select id="lecturerSelect" style={inputStyle} value={formData.lecturer_id} onChange={(e) => setFormData({...formData, lecturer_id: e.target.value})} required>
            <option value="">-- දේශකයෙක් තෝරන්න --</option>
            {lecturers.map((l, idx) => <option key={l.teacher_id || l.lecturer_id || idx} value={l.teacher_id || l.lecturer_id}>{l.teacher_name || l.lecturer_name}</option>)}
          </select>

          <label htmlFor="hallSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශාලාව</label>
          <select id="hallSelect" style={inputStyle} value={formData.hall_id} onChange={(e) => setFormData({...formData, hall_id: e.target.value})} required>
            <option value="">-- ශාලාවක් තෝරන්න --</option>
            {halls.map((h, idx) => <option key={h.hall_id || idx} value={h.hall_id}>{h.hall_name} (Capacity: {h.capacity})</option>)}
          </select>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>සතියේ දින</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
            {daysOfWeek.map(day => (
              <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  value={day}
                  checked={formData.day_of_week.includes(day)}
                  onChange={() => handleDayChange(day)}
                />
                {day}
              </label>
            ))}
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="startTime" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ආරම්භක වේලාව</label>
              <input id="startTime" type="time" style={inputStyle} value={formData.start_time} onChange={(e) => setFormData({...formData, start_time: e.target.value})} required />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="endTime" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>අවසන් වේලාව</label>
              <input id="endTime" type="time" style={inputStyle} value={formData.end_time} onChange={(e) => setFormData({...formData, end_time: e.target.value})} required />
            </div>
          </div>

          <label htmlFor="capacity" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍ය ධාරිතාව</label>
          <input id="capacity" type="number" placeholder="50" style={inputStyle} value={formData.capacity} onChange={(e) => setFormData({...formData, capacity: e.target.value})} required />

          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            {editingScheduleId ? '💾 වෙනස්කම් සුරකින්න' : '💾 කාලසටහන සුරකින්න'}
          </button>
        </form>
      </div>

      {/* RIGHT: Existing Class Schedules */}
      <div style={{ flex: 2, minWidth: '500px', backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>🗓️ පවතින පන්ති කාලසටහන් (Existing Schedules)</h3>
        <input 
          type="text" 
          placeholder="පන්තියේ නම, දේශකයා, හෝ ශාලාව අනුව සොයන්න..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, marginBottom: '15px' }}
        />
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>පන්තිය</th>
                <th style={{ padding: '12px' }}>දේශකයා</th>
                <th style={{ padding: '12px' }}>ශාලාව</th>
                <th style={{ padding: '12px' }}>වේලාව</th>
                <th style={{ padding: '12px' }}>දින</th>
                <th style={{ padding: '12px' }}>ධාරිතාව</th>
                <th style={{ padding: '12px' }}>ක්‍රියාමාර්ග</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.map(schedule => (
                <tr key={schedule.schedule_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{schedule.class_name}<br/><small>{schedule.course_name} - {schedule.subject_name}</small></td>
                  <td style={{ padding: '12px' }}>{schedule.lecturer_name}</td>
                  <td style={{ padding: '12px' }}>{schedule.hall_name}</td>
                  <td style={{ padding: '12px' }}>{schedule.start_time} - {schedule.end_time}</td>
                  <td style={{ padding: '12px' }}>{Array.isArray(schedule.day_of_week) ? schedule.day_of_week.join(', ') : (schedule.day_of_week || '')}</td>
                  <td style={{ padding: '12px' }}>{schedule.capacity}</td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => handleEditClick(schedule)}
                      style={{ padding: '4px 8px', backgroundColor: '#fff8e1', color: '#f57f17', border: '1px solid #ffecb3', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteId(schedule.schedule_id)}
                      style={{ padding: '4px 8px', backgroundColor: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSchedules.length === 0 && (
                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>කාලසටහන් හමුවුනේ නැත.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Custom Confirmation Modal */}
        {confirmDeleteId && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '40px', color: '#d32f2f', marginBottom: '15px' }}>⚠️</div>
              <h3 style={{ margin: '0 0 10px 0', color: '#1a237e' }}>කාලසටහන ඉවත් කිරීම ස්ථිරද?</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. මෙම කාලසටහනට අදාළ සියලුම දත්ත පද්ධතියෙන් ඉවත් වනු ඇත.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '25px' }}>
                <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '10px', border: '1px solid #ccc', background: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>අවලංගු කරන්න</button>
                <button onClick={processDelete} style={{ flex: 1, padding: '10px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>ඔව්, ඉවත් කරන්න</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      {activeSubTab === 'courses' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#1a237e', margin: 0 }}>
                {editingCourseId ? '🔄 පන්තිය සංස්කරණය' : '➕ නව පන්තියක්'}
              </h3>
              {editingCourseId && (
                <button onClick={() => { setEditingCourseId(null); setNewCourse({ course_name: '', monthly_fee: '', teacher_id: '', subject_id: '' }); }} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>අවලංගු කරන්න</button>
              )}
            </div>
            <form onSubmit={handleSubmitCourse}>
              <label>පන්තියේ නම</label>
              <input style={inputStyle} value={newCourse.course_name} onChange={e => setNewCourse({...newCourse, course_name: e.target.value})} required />
              
              <label>මාසික ගාස්තුව</label>
              <input style={inputStyle} type="number" value={newCourse.monthly_fee} onChange={e => setNewCourse({...newCourse, monthly_fee: e.target.value})} required />

              <label>දේශකයා (Teacher)</label>
              <select style={inputStyle} value={newCourse.teacher_id} onChange={e => setNewCourse({...newCourse, teacher_id: e.target.value})}>
                <option value="">-- දේශකයෙකු තෝරන්න (Select Teacher) --</option>
                {lecturers.map(l => <option key={l.teacher_id} value={l.teacher_id}>{l.teacher_name}</option>)}
              </select>

              <label>විෂය (Subject)</label>
              <select style={inputStyle} value={newCourse.subject_id} onChange={e => setNewCourse({...newCourse, subject_id: e.target.value})}>
                <option value="">-- විෂයයක් තෝරන්න (Select Subject) --</option>
                {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
              </select>

              <button style={{ width: '100%', padding: '10px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{editingCourseId ? '💾 වෙනස්කම් සුරකින්න' : '💾 පන්තිය සුරකින්න'}</button>
            </form>
          </div>
          <div style={{ flex: 2, minWidth: '400px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
            <h3 style={{ color: '#1a237e' }}>පන්ති ලැයිස්තුව</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f5f5f5', textAlign: 'left' }}><th style={{ padding: '12px' }}>නම</th><th style={{ padding: '12px' }}>මාසික ගාස්තුව</th><th style={{ padding: '12px' }}>ක්‍රියාමාර්ග</th></tr></thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.course_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{c.course_name}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>රු. {c.monthly_fee ? parseFloat(c.monthly_fee).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => handleEditCourseClick(c)} style={{ padding: '5px 10px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' }}>Edit</button>
                      <button onClick={() => onDeleteCourse(c.course_id)} style={{ padding: '5px 10px', background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'subjects' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#1a237e', margin: 0 }}>
                {editingSubjectId ? '🔄 විෂය සංස්කරණය' : '➕ නව විෂයයක්'}
              </h3>
              {editingSubjectId && (
                <button onClick={() => { setEditingSubjectId(null); setNewSubject({ subject_name: '', description: '' }); }} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>අවලංගු කරන්න</button>
              )}
            </div>
            <form onSubmit={handleSubmitSubject}>
              <label>විෂයෙහි නම</label>
              <input style={inputStyle} value={newSubject.subject_name} onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})} required />
              <label>විස්තරය</label>
              <input style={inputStyle} value={newSubject.description} onChange={e => setNewSubject({...newSubject, description: e.target.value})} />
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{editingSubjectId ? '💾 වෙනස්කම් සුරකින්න' : '💾 සුරකින්න'}</button>
            </form>
          </div>
          <div style={{ flex: 2, minWidth: '400px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
            <h3 style={{ color: '#1a237e' }}>විෂයයන් ලැයිස්තුව</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f5f5f5', textAlign: 'left' }}><th style={{ padding: '12px' }}>නම</th><th style={{ padding: '12px' }}>විස්තරය</th><th style={{ padding: '12px' }}>ක්‍රියාමාර්ග</th></tr></thead>
              <tbody>
                {subjects.map(s => (
                  <tr key={s.subject_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{s.subject_name}</td>
                    <td style={{ padding: '12px' }}>{s.description || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => handleEditSubjectClick(s)} style={{ padding: '5px 10px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' }}>Edit</button>
                      <button onClick={() => onDeleteSubject(s.subject_id)} style={{ padding: '5px 10px', background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'halls' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#1a237e', margin: 0 }}>
                {editingHallId ? '🔄 ශාලාව සංස්කරණය' : '➕ නව ශාලාවක්'}
              </h3>
              {editingHallId && (
                <button onClick={() => { setEditingHallId(null); setNewHall({ hall_name: '', capacity: '' }); }} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>අවලංගු කරන්න</button>
              )}
            </div>
            <form onSubmit={handleSubmitHall}>
              <label>ශාලාවේ නම</label>
              <input style={inputStyle} value={newHall.hall_name} onChange={e => setNewHall({...newHall, hall_name: e.target.value})} required />
              <label>ධාරිතාව</label>
              <input style={inputStyle} type="number" value={newHall.capacity} onChange={e => setNewHall({...newHall, capacity: e.target.value})} required />
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{editingHallId ? '💾 වෙනස්කම් සුරකින්න' : '💾 සුරකින්න'}</button>
            </form>
          </div>
          <div style={{ flex: 2, minWidth: '400px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
            <h3 style={{ color: '#1a237e' }}>ශාලා ලැයිස්තුව</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f5f5f5', textAlign: 'left' }}><th style={{ padding: '12px' }}>නම</th><th style={{ padding: '12px' }}>ධාරිතාව</th><th style={{ padding: '12px' }}>ක්‍රියාමාර්ග</th></tr></thead>
              <tbody>
                {halls.map(h => (
                  <tr key={h.hall_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{h.hall_name}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{h.capacity}</td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => handleEditHallClick(h)} style={{ padding: '5px 10px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' }}>Edit</button>
                      <button onClick={() => onDeleteHall(h.hall_id)} style={{ padding: '5px 10px', background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

ClassTab.propTypes = {
  courses: PropTypes.array.isRequired,
  lecturers: PropTypes.array.isRequired,
  subjects: PropTypes.array.isRequired,
  halls: PropTypes.array.isRequired,
  classSchedules: PropTypes.array.isRequired,
  onCreateClass: PropTypes.func.isRequired,
  onUpdateClass: PropTypes.func.isRequired,
  onDeleteClass: PropTypes.func.isRequired,
  onCreateCourse: PropTypes.func,
  onUpdateCourse: PropTypes.func,
  onDeleteCourse: PropTypes.func,
  onCreateSubject: PropTypes.func,
  onUpdateSubject: PropTypes.func,
  onDeleteSubject: PropTypes.func,
  onCreateHall: PropTypes.func,
  onUpdateHall: PropTypes.func,
  onDeleteHall: PropTypes.func,
};

export default ClassTab;