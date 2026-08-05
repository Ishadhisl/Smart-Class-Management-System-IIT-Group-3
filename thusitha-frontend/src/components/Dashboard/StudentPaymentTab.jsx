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
  
  const user = JSON.parse(localStorage.getItem('user'));

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

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  const handleOpenPaymentModal = () => {
    if (!selectedCourse || !selectedMonth) {
      return showNotification('කරුණාකර පන්තිය සහ මාසය තෝරන්න.', 'error');
    }
    
    const course = courses.find(c => String(c.course_id) === String(selectedCourse));
    const amount = course?.monthly_fee || course?.fee || 1000;
    
    if (!amount) {
      return showNotification('පන්තියේ ගාස්තුව සොයාගත නොහැක.', 'error');
    }
    
    // Reset modal state
    setCardDetails({
      cardholderName: '',
      cardNumber: '',
      expiryDate: '',
      cvv: ''
    });
    setPaymentSuccess(false);
    setIsProcessingPayment(false);
    setShowPaymentModal(true);
  };

  const handleCardPaymentSubmit = async (e) => {
    e.preventDefault();
    
    const cleanCardNo = cardDetails.cardNumber.replace(/\s+/g, '');
    const cleanExpiry = cardDetails.expiryDate.trim();
    const cleanCVV = cardDetails.cvv.trim();
    const name = cardDetails.cardholderName.trim();
    
    if (!name) {
      return showNotification('කරුණාකර කාඩ්පතේ හිමිකරුගේ නම ඇතුළත් කරන්න.', 'error');
    }
    if (cleanCardNo.length !== 16 || isNaN(cleanCardNo)) {
      return showNotification('කාඩ්පත් අංකය ඉලක්කම් 16කින් යුක්ත විය යුතුය.', 'error');
    }
    if (!/^\d{2}\/\d{2}$/.test(cleanExpiry)) {
      return showNotification('කල් ඉකුත්වන දිනය MM/YY ආකාරයට ඇතුළත් කරන්න.', 'error');
    }
    if (cleanCVV.length !== 3 || isNaN(cleanCVV)) {
      return showNotification('CVV අංකය ඉලක්කම් 3කින් යුක්ත විය යුතුය.', 'error');
    }
    
    setIsProcessingPayment(true);
    
    const course = courses.find(c => String(c.course_id) === String(selectedCourse));
    const amount = course?.monthly_fee || course?.fee || 1000;
    
    try {
      const res = await request('/payments/create-checkout-session', {
        method: 'POST',
        body: {
          student_id: (user.userId || user.id),
          course_id: selectedCourse,
          amount_paid: amount,
          for_month: selectedMonth
        }
      });
      
      setTimeout(() => {
        setIsProcessingPayment(false);
        if (res.dummy_success) {
          setPaymentSuccess(true);
          setTimeout(() => {
            setShowPaymentModal(false);
            showNotification('ගෙවීම් කටයුත්ත සාර්ථකව නිම කරන ලදී!');
            setSelectedCourse('');
            setSelectedMonth('');
            fetchPayments();
          }, 1500);
        } else if (res.url) {
          window.location.href = res.url;
        }
      }, 1500);
      
    } catch (err) {
      setIsProcessingPayment(false);
      showNotification(err.message || 'ගෙවීම් පිටුවට පිවිසීමට නොහැකි විය.', 'error');
    }
  };

  const handleReceiptUpload = async (paymentId) => {
    if (!uploadFile) return showNotification('කරුණාකර රිසිට් පතක් තෝරන්න.', 'error');
    
    const formData = new FormData();
    formData.append('receipt', uploadFile);
    
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

    const course = courses.find(c => String(c.course_id) === String(selectedCourse));
    const amount = course?.monthly_fee || course?.fee || 1000;

    const formData = new FormData();
    formData.append('student_id', user.userId || user.id);
    formData.append('course_id', selectedCourse);
    formData.append('amount_paid', amount);
    formData.append('for_month', selectedMonth);
    formData.append('receipt', manualReceipt);

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
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Completed': return '#4caf50';
      case 'Pending Verification': return '#ff9800';
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
            onClick={handleOpenPaymentModal}
            style={{ padding: '12px 24px', backgroundColor: '#6772e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <CreditCard size={18} /> Pay with Card (Stripe)
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
              disabled={!manualReceipt || !selectedCourse || !selectedMonth}
              style={{ padding: '10px 20px', backgroundColor: (!manualReceipt || !selectedCourse || !selectedMonth) ? '#ccc' : '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: (!manualReceipt || !selectedCourse || !selectedMonth) ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <UploadCloud size={18} /> රිසිට් පත යවන්න
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
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
                              style={{ padding: '6px 12px', backgroundColor: '#00b0ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <UploadCloud size={14} /> Upload
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

      {/* 💳 DUMMY PAYMENT MODAL */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', width: '100%', maxWidth: '420px', boxShadow: '0 15px 35px rgba(0,0,0,0.15)', position: 'relative', fontFamily: 'sans-serif' }}>
            
            {!isProcessingPayment && !paymentSuccess && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#1a237e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={22} /> Card Details (Sandbox)
                  </h3>
                  <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>&times;</button>
                </div>
                
                <form onSubmit={handleCardPaymentSubmit}>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>Cardholder Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      value={cardDetails.cardholderName}
                      onChange={(e) => setCardDetails({...cardDetails, cardholderName: e.target.value})}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>Card Number</label>
                    <input 
                      type="text" 
                      placeholder="4242 4242 4242 4242"
                      maxLength="19"
                      value={cardDetails.cardNumber}
                      onChange={(e) => setCardDetails({...cardDetails, cardNumber: formatCardNumber(e.target.value)})}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>Expiry Date</label>
                      <input 
                        type="text" 
                        placeholder="MM/YY"
                        maxLength="5"
                        value={cardDetails.expiryDate}
                        onChange={(e) => setCardDetails({...cardDetails, expiryDate: formatExpiry(e.target.value)})}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>CVV</label>
                      <input 
                        type="password" 
                        placeholder="123"
                        maxLength="3"
                        value={cardDetails.cvv}
                        onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value.replace(/[^0-9]/g, '')})}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                        required
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="submit"
                    style={{ width: '100%', padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                  >
                    Pay LKR {(courses.find(c => String(c.course_id) === String(selectedCourse))?.monthly_fee || 1000)}
                  </button>
                </form>
              </>
            )}

            {isProcessingPayment && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #1a237e', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h4 style={{ marginTop: '20px', color: '#1a237e' }}>ගනුදෙනුව සිදුවෙමින් පවතී...</h4>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>කරුණාකර මෙම ජනේලය වසා නොදමන්න.</p>
              </div>
            )}

            {paymentSuccess && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '50px', color: '#2e7d32', animation: 'scaleUp 0.3s ease-out' }}>✓</div>
                <h3 style={{ color: '#2e7d32', margin: '10px 0' }}>ගෙවීම සාර්ථකයි!</h3>
                <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>ඔබගේ ගෙවීම සාර්ථකව සටහන් කර ගන්නා ලදී.</p>
              </div>
            )}
            
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scaleUp {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default StudentPaymentTab;
