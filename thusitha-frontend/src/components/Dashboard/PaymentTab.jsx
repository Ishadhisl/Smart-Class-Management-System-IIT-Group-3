import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request, BASE_URL } from '../../services/api';
import { SearchableSelect } from './Tabs/AchievementTab';
import { generateReceiptPDF } from '../../utils/generateReceiptPDF';
import FormError from '../common/FormError';
import { validateRequired, validateNumber, blockNegativeKeys, filterNonNegativeNumber, NUMBER_INVALID_MSG } from '../../utils/formValidation';
import { useFieldValidation } from '../../utils/useFieldValidation';

const PaymentTab = ({ students, courses, onRecordPayment, onSendReminders, role }) => {
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    amount_paid: '',
    for_month: '',
    payment_method: 'Cash'
  });

  const [enrolledStudents, setEnrolledStudents] = useState([]);

  const handleCourseChange = (e) => {
    const selectedCourseId = e.target.value;
    // course_id can be string or number, so use loose equality or convert
    const selectedCourse = courses.find(c => String(c.course_id) === String(selectedCourseId));

    setFormData({
      ...formData,
      course_id: selectedCourseId,
      student_id: '',
      amount_paid: selectedCourse ? (selectedCourse.monthly_fee || selectedCourse.fee || '') : ''
    });
  };

  useEffect(() => {
    if (formData.course_id) {
      request(`/enrollments/course/${formData.course_id}`)
        .then(data => setEnrolledStudents(data))
        .catch(err => console.error('Failed to fetch enrolled students:', err));
    } else {
      setEnrolledStudents([]);
    }
  }, [formData.course_id]);

  const [reminderData, setReminderData] = useState({
    course_id: '',
    for_month: ''
  });

  const paymentRules = (d) => ({
    course_id: () => validateRequired(d.course_id, 'පන්තිය'),
    student_id: () => validateRequired(d.student_id, 'ශිෂ්‍යයා'),
    amount_paid: () => validateNumber(d.amount_paid, { label: 'මුදල', min: 1, max: 1000000 }),
    for_month: () => validateRequired(d.for_month, 'අදාළ මාසය'),
  });
  const pv = useFieldValidation(formData, setFormData, paymentRules, { course_id: 'courseSelect', amount_paid: 'amountPaid', for_month: 'forMonth' });

  const reminderRules = (d) => ({
    course_id: () => validateRequired(d.course_id, 'පන්තිය'),
    for_month: () => validateRequired(d.for_month, 'අදාළ මාසය'),
  });
  const rv = useFieldValidation(reminderData, setReminderData, reminderRules, { course_id: 'reminderCourse', for_month: 'reminderMonth' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pv.validateAll()) return;
    pv.clear();
    onRecordPayment(formData);
  };

  const handleReminderSubmit = (e) => {
    e.preventDefault();
    if (!rv.validateAll()) return;
    rv.clear();
    onSendReminders(reminderData);
  };

  const [filterCourse, setFilterCourse] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentsList, setPaymentsList] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchFilteredPayments = async () => {
    setSearchLoading(true);
    try {
      let url = '/payments?';
      if (filterCourse) url += `course_id=${filterCourse}&`;
      if (filterMonth) url += `for_month=${filterMonth}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const data = await request(url);
      setPaymentsList(data || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    }
    setSearchLoading(false);
  };

  useEffect(() => {
    fetchFilteredPayments();
  }, [filterCourse, filterMonth]); // Auto fetch when dropdowns change

  const handleVerify = async (paymentId, status) => {
    const comments = status === 'Completed' ? 'Approved by staff' : 'Rejected by staff';
    try {
      await request(`/payments/${paymentId}/verify`, {
        method: 'PUT',
        body: { status, comments }
      });
      fetchFilteredPayments();
    } catch (err) {
      console.error('Failed to verify payment:', err);
    }
  };

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' };
  const errStyle = (msg) => (msg ? { ...inputStyle, border: '1px solid #d32f2f', marginBottom: '4px' } : inputStyle);

  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', flexDirection: 'column' }}>

      {role !== 'Teacher' && (
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%' }}>
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', maxWidth: '600px', flex: 1.5 }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>💰 ගෙවීම් සටහන් කිරීම (Record Payment)</h3>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="courseSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තිය තෝරන්න *</label>
          <select id="courseSelect" style={errStyle(pv.errors.course_id)} value={formData.course_id} onChange={handleCourseChange} onBlur={() => pv.blur('course_id')}>
            <option value="">-- පන්තිය තෝරන්න --</option>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name} - {c.teacher_name}</option>)}
          </select>
          {pv.errors.course_id && <FormError className="mb-3">{pv.errors.course_id}</FormError>}

          <label htmlFor="studentSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍යයා තෝරන්න *</label>
          <SearchableSelect
            options={enrolledStudents.map(s => ({ value: s.student_id, label: `${s.student_name} (${s.qr_code_key})` }))}
            value={formData.student_id}
            onChange={(val) => pv.set('student_id', val)}
          />
          {pv.errors.student_id && <FormError className="-mt-3 mb-3">{pv.errors.student_id}</FormError>}

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="amountPaid" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>මුදල (Rs.) *</label>
              <input id="amountPaid" type="number" min="1" placeholder="උදා: 2500" style={errStyle(pv.errors.amount_paid)} value={formData.amount_paid} onKeyDown={blockNegativeKeys} onChange={(e) => pv.set('amount_paid', e.target.value, filterNonNegativeNumber, NUMBER_INVALID_MSG)} onBlur={() => pv.blur('amount_paid')} />
              {pv.errors.amount_paid && <FormError className="mb-3">{pv.errors.amount_paid}</FormError>}
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="forMonth" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>අදාළ මාසය *</label>
              <select id="forMonth" style={errStyle(pv.errors.for_month)} value={formData.for_month} onChange={(e) => pv.set('for_month', e.target.value)} onBlur={() => pv.blur('for_month')}>
                <option value="">-- මාසය තෝරන්න --</option>
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
              {pv.errors.for_month && <FormError className="mb-3">{pv.errors.for_month}</FormError>}
            </div>
          </div>

          <button
            type="submit"
            style={{ width: '100%', padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
          >
            💾 ගෙවීම සුරකින්න
          </button>
        </form>
        </div>

        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', maxWidth: '400px', flex: 1, height: 'fit-content' }}>
          <h3 style={{ color: '#25d366', marginBottom: '20px' }}>🔔 හිඟ මුදල් මතක් කිරීම</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>තෝරාගත් පන්තියේ අදාළ මාසය සඳහා ගෙවීම් නොකළ සිසුන්ගේ මව්පියන්ට WhatsApp පණිවිඩ යැවීම.</p>
          <form onSubmit={handleReminderSubmit} noValidate>
            <label htmlFor="reminderCourse" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තිය තෝරන්න *</label>
            <select id="reminderCourse" style={errStyle(rv.errors.course_id)} value={reminderData.course_id} onChange={(e) => rv.set('course_id', e.target.value)} onBlur={() => rv.blur('course_id')}>
              <option value="">-- පන්තිය තෝරන්න --</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </select>
            {rv.errors.course_id && <FormError className="mb-3">{rv.errors.course_id}</FormError>}

            <label htmlFor="reminderMonth" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>අදාළ මාසය *</label>
            <select id="reminderMonth" style={errStyle(rv.errors.for_month)} value={reminderData.for_month} onChange={(e) => rv.set('for_month', e.target.value)} onBlur={() => rv.blur('for_month')}>
              <option value="">-- මාසය තෝරන්න --</option>
              <option value="January">January</option>
              <option value="February">February</option>
              <option value="March">March</option>
              <option value="April">April</option>
              <option value="May">May</option>
              <option value="June">June</option>
              <option value="July">July</option>
              <option value="August">August</option>
              <option value="September">September</option>
              <option value="October">October</option>
              <option value="November">November</option>
              <option value="December">December</option>
            </select>
            {rv.errors.for_month && <FormError className="mb-3">{rv.errors.for_month}</FormError>}

            <button
              type="submit"
              style={{ width: '100%', padding: '12px', backgroundColor: '#25d366', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              💬 මතක් කිරීම් WhatsApp යවන්න
            </button>
          </form>
        </div>
      </div>
      )}

      {/* 🔍 SEARCH & FILTER PAYMENTS PANEL */}
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', width: '100%', marginTop: '20px' }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🔍 ගෙවීම් විස්තර සෙවීම සහ තහවුරු කිරීම (Search & Manage Payments)
        </h3>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තිය අනුව පෙරන්න</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
            >
              <option value="">-- සියලුම පන්ති --</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>මාසය අනුව පෙරන්න</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="">-- සියලුම මාස --</option>
              <option value="January">January</option>
              <option value="February">February</option>
              <option value="March">March</option>
              <option value="April">April</option>
              <option value="May">May</option>
              <option value="June">June</option>
              <option value="July">July</option>
              <option value="August">August</option>
              <option value="September">September</option>
              <option value="October">October</option>
              <option value="November">November</option>
              <option value="December">December</option>
            </select>
          </div>

          <div style={{ flex: 1.5, minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍යයා සොයන්න (නම / QR)</label>
            <input
              type="text"
              placeholder="e.g. Ruwan or ST001"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={fetchFilteredPayments}
            style={{ padding: '12px 24px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            සොයන්න (Search)
          </button>
        </div>

        {searchLoading ? (
          <p>Loading payments...</p>
        ) : paymentsList.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>ගෙවීම් දත්ත කිසිවක් හමු නොවීය.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f6fa', color: '#333', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '12px' }}>දිනය</th>
                  <th style={{ padding: '12px' }}>ශිෂ්‍යයා</th>
                  <th style={{ padding: '12px' }}>පන්තිය</th>
                  <th style={{ padding: '12px' }}>මාසය</th>
                  <th style={{ padding: '12px' }}>මුදල</th>
                  <th style={{ padding: '12px' }}>ක්‍රමය</th>
                  <th style={{ padding: '12px' }}>තත්වය</th>
                  <th style={{ padding: '12px' }}>ක්‍රියාමාර්ග / රිසිට්පත්</th>
                </tr>
              </thead>
              <tbody>
                {paymentsList.map(p => (
                  <tr key={p.payment_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.student_name} <span style={{ fontSize: '11px', color: '#666', fontWeight: 'normal' }}>({p.qr_code_key})</span></td>
                    <td style={{ padding: '12px' }}>{p.course_name}</td>
                    <td style={{ padding: '12px' }}>{p.for_month}</td>
                    <td style={{ padding: '12px' }}>Rs. {p.amount_paid}</td>
                    <td style={{ padding: '12px' }}>{p.payment_method}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        backgroundColor: (p.payment_status === 'Completed' ? '#4caf50' : p.payment_status === 'Rejected' ? '#f44336' : '#ff9800') + '20',
                        color: p.payment_status === 'Completed' ? '#4caf50' : p.payment_status === 'Rejected' ? '#f44336' : '#ff9800'
                      }}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {p.payment_status === 'Completed' && (
                          <button
                            onClick={() => generateReceiptPDF(p)}
                            style={{ padding: '4px 8px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Receipt PDF
                          </button>
                        )}
                        {p.confirmation_url && (
                          <a href={`${BASE_URL}${p.confirmation_url}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0056b3', textDecoration: 'none', fontWeight: 'bold', border: '1px solid #0056b3', padding: '4px 8px', borderRadius: '4px' }}>
                            View Slip
                          </a>
                        )}
                        {/* 'Pending' = PayHere checkout whose notify callback hasn't arrived (never will on a
                            localhost backend) - let staff confirm it manually, same as a bank slip. */}
                        {(p.payment_status === 'Pending Verification' || p.payment_status === 'Pending') && role !== 'Teacher' && (
                          <>
                            <button
                              onClick={() => handleVerify(p.payment_id, 'Completed')}
                              style={{ padding: '4px 8px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerify(p.payment_id, 'Rejected')}
                              style={{ padding: '4px 8px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

PaymentTab.propTypes = {
  students: PropTypes.arrayOf(PropTypes.object).isRequired,
  courses: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRecordPayment: PropTypes.func.isRequired,
  onSendReminders: PropTypes.func.isRequired,
};

export default PaymentTab;