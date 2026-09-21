import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import FormError from '../common/FormError';
import { filterTextInput, TEXT_INVALID_MSG, validateRequired } from '../../utils/formValidation';
import { useFieldValidation } from '../../utils/useFieldValidation';

const EnrollmentTab = ({ students, courses, onEnroll }) => {
  const [formData, setFormData] = useState({ student_id: '', course_id: '' });
  const [studentSearch, setStudentSearch] = useState('');

  // States for viewing enrolled students
  const [viewCourseId, setViewCourseId] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const rules = (d) => ({
    student_id: () => validateRequired(d.student_id, 'ශිෂ්‍යයා'),
    course_id: () => validateRequired(d.course_id, 'පන්තිය'),
  });
  const v = useFieldValidation(formData, setFormData, rules, { student_id: 'enrollStudent', course_id: 'enrollCourse' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    v.clear();
    onEnroll(formData);
  };

  const fetchEnrolledStudents = async (courseId) => {
    if (!courseId) {
      setEnrolledStudents([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await request(`/enrollments/course/${courseId}`);
      setEnrolledStudents(data || []);
    } catch (err) {
      setError(err.message || 'දත්ත ලබාගැනීමට නොහැකි විය.');
      setEnrolledStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrolledStudents(viewCourseId);
  }, [viewCourseId]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    String(s.studentId).toLowerCase().includes(studentSearch.toLowerCase())
  );

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' };
  const errStyle = (msg) => (msg ? { ...inputStyle, border: '1px solid #d32f2f', marginBottom: '4px' } : inputStyle);
  const cardStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>

      {/* 1. Enrollment Form (Left Side) */}
      <div style={cardStyle}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px', fontSize: '18px' }}>🔗 නව ලියාපදිංචිය (New Enrollment)</h3>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="enrollStudentSearch" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍යයා සොයන්න</label>
          <input
            id="enrollStudentSearch"
            type="text"
            placeholder="උදා: Kamal හෝ ST084"
            maxLength={100}
            value={studentSearch}
            onChange={(e) => setStudentSearch(filterTextInput(e.target.value))}
            title={TEXT_INVALID_MSG}
            style={inputStyle}
          />

          <label htmlFor="enrollStudent" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍යයා තෝරන්න *</label>
          <select id="enrollStudent" style={errStyle(v.errors.student_id)} value={formData.student_id} onChange={(e) => v.set('student_id', e.target.value)} onBlur={() => v.blur('student_id')}>
            <option value="">-- ශිෂ්‍යයා තෝරන්න --</option>
            {filteredStudents.map(s => <option key={s._id} value={s._id}>{s.name} ({s.studentId})</option>)}
          </select>
          {v.errors.student_id && <FormError className="mb-3">{v.errors.student_id}</FormError>}

          <label htmlFor="enrollCourse" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තිය තෝරන්න *</label>
          <select id="enrollCourse" style={errStyle(v.errors.course_id)} value={formData.course_id} onChange={(e) => v.set('course_id', e.target.value)} onBlur={() => v.blur('course_id')}>
            <option value="">-- පන්තිය තෝරන්න --</option>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name} - {c.teacher_name}</option>)}
          </select>
          {v.errors.course_id && <FormError className="mb-3">{v.errors.course_id}</FormError>}

          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            💾 ලියාපදිංචි කරන්න
          </button>
        </form>
      </div>

      {/* 2. Enrolled Students List (Right Side) */}
      <div style={cardStyle}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px', fontSize: '18px' }}>📋 ලියාපදිංචි සිසුන්ගේ ලැයිස්තුව (Enrolled List)</h3>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="viewCourse" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>ලැයිස්තුව බැලීමට පන්තිය තෝරන්න</label>
          <select
            id="viewCourse"
            style={{ ...inputStyle, marginBottom: 0, borderColor: '#1a237e', backgroundColor: '#f8f9fa' }}
            value={viewCourseId}
            onChange={(e) => setViewCourseId(e.target.value)}
          >
            <option value="">-- පන්තියක් තෝරාගන්න --</option>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name} - {c.teacher_name}</option>)}
          </select>
        </div>

        {error && (
          <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '5px', marginBottom: '15px' }}>
            ⚠️ {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>දත්ත ලබාගනිමින් පවතී (Loading)...</div>
        ) : viewCourseId ? (
          enrolledStudents.length > 0 ? (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'max(300px, calc(100vh - 360px))', border: '1px solid #e3e6f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px 10px', color: '#333' }}>QR අංකය (Key)</th>
                    <th style={{ padding: '12px 10px', color: '#333' }}>ශිෂ්‍යයාගේ නම</th>
                    <th style={{ padding: '12px 10px', color: '#333' }}>ලියාපදිංචි දිනය</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((student, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#1a237e' }}>{student.qr_code_key}</td>
                      <td style={{ padding: '12px 10px' }}>{student.student_name}</td>
                      <td style={{ padding: '12px 10px', color: '#666' }}>
                        {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '15px', fontSize: '13px', color: '#666', textAlign: 'right' }}>
                එකතුව සිසුන්: <strong>{enrolledStudents.length}</strong>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px', color: '#666' }}>
              මෙම පන්තිය සඳහා සිසුන් ලියාපදිංචි වී නොමැත.
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 20px', backgroundColor: '#f8f9fa', borderRadius: '5px', color: '#888', border: '1px dashed #ccc' }}>
            කරුණාකර ඉහතින් පන්තියක් තෝරන්න.
          </div>
        )}
      </div>

    </div>
  );
};

EnrollmentTab.propTypes = {
  students: PropTypes.arrayOf(PropTypes.object).isRequired,
  courses: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEnroll: PropTypes.func.isRequired,
};

export default EnrollmentTab;