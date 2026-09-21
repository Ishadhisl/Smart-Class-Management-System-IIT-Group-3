import React, { useState, useEffect } from 'react';
import { request, BASE_URL } from '../../services/api';
import { CreditCard, UploadCloud, CheckCircle, Download } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { generateReceiptPDF } from '../../utils/generateReceiptPDF';

const StudentPaymentTab = ({ courses }) => {
  const { showNotification } = useNotification();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploadingConfirmation, setIsUploadingConfirmation] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const user = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    if (!user || !(user.userId || user.id)) return; // Prevent fetch if no user
    setLoading(true);
    try {
      const data = await request(`/payments/student/${user.userId || user.id}`);
      setPayments(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const [isInitiatingPayHere, setIsInitiatingPayHere] = useState(false);

  const handlePayHerePayment = async () => {
    if (!selectedCourse || !selectedMonth) {
      return showNotification('කරුණාකර පන්තිය සහ මාසය තෝරන්න.', 'error');
    }

    const course = courses.find(c => String(c.course_id) === String(selectedCourse));
    const amount = course?.monthly_fee || course?.fee || 1000;

    if (!amount) {
      return showNotification('පන්තියේ ගාස්තුව සොයාගත නොහැක.', 'error');
    }

    setIsInitiatingPayHere(true);

    try {
      const res = await request('/payments/payhere/initiate', {
        method: 'POST',
        body: {
          student_id: (user.userId || user.id),
          course_id: selectedCourse,
          for_month: selectedMonth
        }
      });

      if (!res || !res.action_url || !res.params) {
        throw new Error('PayHere ගෙවීම් දත්ත ලබා ගැනීමට නොහැකි විය.');
      }

      showNotification('PayHere වෙත යොමු කෙරේ... කරුණාකර රැඳී සිටින්න.');

      // Create hidden form and submit to PayHere checkout
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = res.action_url;

      Object.entries(res.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = val;
          form.appendChild(input);
        }
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setIsInitiatingPayHere(false);
      showNotification(err.message || 'PayHere ගෙවීම ආරම්භ කිරීමට නොහැකි විය.', 'error');
    }
  };

  const handleReceiptUpload = async (paymentId) => {
    if (!uploadFile) return showNotification('කරුණාකර රිසිට් පතක් තෝරන්න.', 'error');
    if (isUploadingConfirmation) return;

    const formData = new FormData();
    formData.append('receipt', uploadFile);

    setIsUploadingConfirmation(true);
    try {
      await request(`/payments/${paymentId}/upload-confirmation`, {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      showNotification('රිසිට් පත සාර්ථකව උඩුගත කරන ලදී.');
      setUploadFile(null);
      fetchPayments();
    } catch (err) {
      showNotification(err.message || 'උඩුගත කිරීම අසාර්ථකයි.', 'error');
    } finally {
      setIsUploadingConfirmation(false);
    }
  };

  const [manualReceipt, setManualReceipt] = useState(null);

  const handleManualPayment = async () => {
    if (!selectedCourse || !selectedMonth) {
      return showNotification('කරුණාකර පන්තිය සහ මාසය තෝරන්න.', 'error');
    }
    if (!manualReceipt) {
      return showNotification('කරුණාකර බැංකු රිසිට් පත තෝරන්න.', 'error');
    }
    if (isSubmittingManual) return;

    const course = courses.find(c => String(c.course_id) === String(selectedCourse));
    const amount = course?.monthly_fee || course?.fee || 1000;

    const formData = new FormData();
    formData.append('student_id', user.userId || user.id);
    formData.append('course_id', selectedCourse);
    formData.append('amount_paid', amount);
    formData.append('for_month', selectedMonth);
    formData.append('receipt', manualReceipt);

    setIsSubmittingManual(true);
    try {
      await request('/payments/manual', {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      showNotification('ගෙවීම් රිසිට් පත සාර්ථකව උඩුගත කරන ලදී. තහවුරු කරන තෙක් රැඳී සිටින්න.');
      setManualReceipt(null);
      setSelectedCourse('');
      setSelectedMonth('');
      fetchPayments();
    } catch (err) {
      showNotification(err.message || 'උඩුගත කිරීම අසාර්ථකයි.', 'error');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return '#4caf50';
      case 'Pending Verification': return '#ff9800';
      case 'Pending': return '#ff9800';
      case 'Rejected': return '#f44336';
      default: return '#666';
    }
  };

  const currentMonthIndex = new Date().getMonth();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthName = months[currentMonthIndex];

  const unpaidCourses = courses.filter(course => {
    const hasPaid = payments.some(p => String(p.course_id) === String(course.course_id) && p.for_month === currentMonthName && (p.payment_status === 'Completed' || p.payment_status === 'Pending Verification'));
    return !hasPaid;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {!loading && unpaidCourses.length > 0 && (
        <div style={{ backgroundColor: '#fff3e0', padding: '15px 20px', borderRadius: '10px', borderLeft: '5px solid #ff9800', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '24px' }}>⚠️</div>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#e65100' }}>ඔබ මෙම මාසයේ ({currentMonthName}) ගාස්තු ගෙවා නොමැති පන්ති:</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {unpaidCourses.map(c => (
                <span key={c.course_id} style={{ backgroundColor: '#ffe0b2', padding: '4px 10px', borderRadius: '15px', fontSize: '13px', fontWeight: 'bold', color: '#e65100' }}>
                  {c.course_name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CreditCard size={24} /> නව ගෙවීමක් කරන්න (Make a Payment)
        </h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පන්තිය</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="">-- පන්තිය තෝරන්න --</option>
              {courses.map(c => (
                <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>මාසය</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">-- මාසය තෝරන්න --</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePayHerePayment}
            disabled={isInitiatingPayHere || !selectedCourse || !selectedMonth}
            style={{
              padding: '12px 24px',
              backgroundColor: (isInitiatingPayHere || !selectedCourse || !selectedMonth) ? '#a5d6a7' : '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (isInitiatingPayHere || !selectedCourse || !selectedMonth) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              transition: 'background-color 0.2s'
            }}
          >
            <CreditCard size={18} /> {isInitiatingPayHere ? 'PayHere වෙත යොමු කරමින්...' : 'Pay with PayHere (කාඩ්පත් / HelaPay)'}
          </button>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', border: '1px dashed #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>බැංකු රිසිට් පත උඩුගත කිරීම (Bank Receipt Upload)</h4>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setManualReceipt(e.target.files[0])}
              style={{ padding: '8px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
            />
            <button
              onClick={handleManualPayment}
              disabled={!manualReceipt || !selectedCourse || !selectedMonth || isSubmittingManual}
              style={{ padding: '10px 20px', backgroundColor: (!manualReceipt || !selectedCourse || !selectedMonth || isSubmittingManual) ? '#ccc' : '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: (!manualReceipt || !selectedCourse || !selectedMonth || isSubmittingManual) ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <UploadCloud size={18} /> {isSubmittingManual ? 'යවමින්...' : 'රිසිට් පත යවන්න'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>මගේ ගෙවීම් ඉතිහාසය (My Payments)</h3>
        {loading ? (
          <p>Loading payments...</p>
        ) : payments.length === 0 ? (
          <p style={{ color: '#666' }}>ගෙවීම් කිසිවක් හමුවුනේ නැත.</p>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'max(300px, calc(100vh - 420px))', border: '1px solid #e3e6f0', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ backgroundColor: '#f5f6fa', color: '#333' }}>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>දිනය</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>පන්තිය</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>මාසය</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>මුදල (Rs)</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>තත්වය</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>ලැබීම් පත්‍රිකා (Receipts)</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.payment_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td style={{ padding: '12px' }}>{p.course_name}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.for_month}</td>
                    <td style={{ padding: '12px' }}>{p.amount_paid}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: getStatusColor(p.payment_status) + '20', color: getStatusColor(p.payment_status) }}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                        {p.payment_status === 'Completed' && (
                          <button
                            onClick={() => generateReceiptPDF({
                              ...p,
                              student_name: p.student_name || user.username || 'Student'
                            })}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <Download size={14} /> Receipt PDF
                          </button>
                        )}
                        {p.confirmation_url && (
                          <a href={`${BASE_URL}${p.confirmation_url}`} target="_blank" rel="noreferrer" style={{ color: '#0056b3', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                            <CheckCircle size={16} /> View Slip
                          </a>
                        )}
                        {!p.confirmation_url && p.payment_status !== 'Completed' && (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => setUploadFile(e.target.files[0])}
                              style={{ fontSize: '12px', maxWidth: '180px' }}
                            />
                            <button
                              onClick={() => handleReceiptUpload(p.payment_id)}
                              disabled={isUploadingConfirmation}
                              style={{ padding: '6px 12px', backgroundColor: isUploadingConfirmation ? '#ccc' : '#00b0ff', color: 'white', border: 'none', borderRadius: '4px', cursor: isUploadingConfirmation ? 'not-allowed' : 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <UploadCloud size={14} /> {isUploadingConfirmation ? 'Uploading...' : 'Upload'}
                            </button>
                          </div>
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

export default StudentPaymentTab;
