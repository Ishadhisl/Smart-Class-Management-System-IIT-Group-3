import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { filterTextInput, TEXT_INVALID_MSG } from '../../utils/formValidation';

// Same English month names PaymentTab writes into Payments.for_month, with Sinhala labels.
const MONTHS = [
  ['January', 'ජනවාරි'], ['February', 'පෙබරවාරි'], ['March', 'මාර්තු'], ['April', 'අප්‍රේල්'],
  ['May', 'මැයි'], ['June', 'ජූනි'], ['July', 'ජූලි'], ['August', 'අගෝස්තු'],
  ['September', 'සැප්තැම්බර්'], ['October', 'ඔක්තෝබර්'], ['November', 'නොවැම්බර්'], ['December', 'දෙසැම්බර්'],
];
const CURRENT_MONTH = MONTHS[new Date().getMonth()][0];
const sinhalaMonth = (en) => (MONTHS.find(([e]) => e === en) || [en, en])[1];

const WHATSAPP_GREEN = '#25d366';
const NAVY = '#1a237e';

// Mirrors the actual send-time templates in thusitha-backend/controllers/smsController.js -
// {class_name} and {month}/{date} are filled in per-student server-side (each selected
// student can be in a different class with a different upcoming exam date), so this preview
// only stands in placeholder text for them - see the substitution below.
const MESSAGE_TEMPLATES = {
  payment: `💰 *Thusitha Institute — ගෙවීම් සිහිකැඳවීම*\n\n👤 {student_name} ({class_name}) ගේ {month} මාසයේ ගෙවීම් ශේෂය ඇත.\nකරුණාකර ඉක්මනින් ගෙවීම සිදු කරන්න.\n\n📞 _Thusitha Institute_`,
  exam: `📝 *Thusitha Institute — විභාග දැනුම්දීම*\n\n👤 {student_name} ({class_name}) සඳහා {date} දින ඉදිරි විභාගය පවතී.\nකරුණාකර හොඳින් සූදානම් වන්න! 📚\n\n📞 _Thusitha Institute_`,
  attendance: `📋 *Thusitha Institute — පැමිණීම් දැනුම්දීම*\n\n👤 {student_name} ({class_name}) ගේ {date} දිනයේ පැමිණීම සම්බන්ධව දැනුම්දීමක් ඇත.\nකරුණාකර ආයතනය හා සම්බන්ධ වන්න.\n\n📞 _Thusitha Institute_`,
  general: `📢 *Thusitha Institute — දැනුම්දීම*\n\n👤 {student_name} ගේ මව්පිය,\n\n{custom_message}\n\n📞 _Thusitha Institute_`,
};

const ReminderTab = ({ students, courses, onSendReminder, whatsappStatus }) => {
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [messageType, setMessageType] = useState('payment');
  const [customMessage, setCustomMessage] = useState('');
  const [messageNotice, setMessageNotice] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  // Payment reminders: the month being chased + the students who still owe for it.
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [unpaidIds, setUnpaidIds] = useState(null);   // null = not loaded / not applicable
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const isPaymentMode = messageType === 'payment';
  const paymentReady = isPaymentMode && selectedCourse && selectedMonth;

  // Filter students by search and course. In payment mode with a class + month picked, only
  // the students who have NOT paid for that month are listed (and pre-selected below).
  const filteredStudents = students.filter(s => {
    const matchName = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.studentId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCourse = !selectedCourse || (s.courseIds || []).includes(Number(selectedCourse));
    const matchUnpaid = !(paymentReady && Array.isArray(unpaidIds)) || unpaidIds.includes(Number(s._id));
    return matchName && matchCourse && matchUnpaid;
  });

  // Load the unpaid list whenever the payment class/month changes; pre-select all of them.
  useEffect(() => {
    if (!paymentReady) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => setUnpaidLoading(true), 0);
    request(`/payments/reports/overdue?month=${encodeURIComponent(selectedMonth)}&course_id=${selectedCourse}`)
      .then((rows) => {
        if (cancelled) return;
        const ids = (rows || []).map(r => Number(r.student_id));
        setUnpaidIds(ids);
        setSelectedStudents(ids);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Unpaid list load failed:', err);
        setUnpaidIds([]);
        setSelectedStudents([]);
      })
      .finally(() => { if (!cancelled) setUnpaidLoading(false); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [paymentReady, selectedCourse, selectedMonth]);

  // Switching message type / class / month clears a selection made under different rules.
  const changeMessageType = (key) => { setMessageType(key); setSelectedStudents([]); setUnpaidIds(null); };
  const changeCourse = (id) => { setSelectedCourse(id); setSelectedStudents([]); setUnpaidIds(null); };
  const changeMonth = (m) => { setSelectedMonth(m); setSelectedStudents([]); setUnpaidIds(null); };

  // Update preview whenever template or custom message changes
  useEffect(() => {
    const template = messageType === 'custom'
      ? customMessage
      : (MESSAGE_TEMPLATES[messageType] || '').replace('{custom_message}', customMessage || 'දැනුම්දීම');

    // Sample values rather than the bare words "class"/"month"/"date" - the template text
    // around {month} already reads "... {month} මාසයේ ..." ("... the month of {month} ..."),
    // so substituting the literal word "මාසය" there produced a confusing "මාසය මාසයේ".
    const courseName = courses.find(c => String(c.course_id) === String(selectedCourse))?.course_name || 'Grade 10 Mathematics';
    const preview = template
      .replace(/{student_name}/g, 'කසුන් බණ්ඩාර')
      .replace(/{parent_name}/g, 'මව්පිය')
      .replace(/{class_name}/g, courseName)
      .replace(/{month}/g, `${sinhalaMonth(selectedMonth)} ${new Date().getFullYear()}`)
      .replace(/{date}/g, '05/09/2026');
    setPreviewMessage(preview);
  }, [messageType, customMessage, selectedCourse, selectedMonth, courses]);

  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s._id));
    }
  };

  const handleSend = async () => {
    if (isPaymentMode && (!selectedCourse || !selectedMonth)) {
      alert('ගෙවීම් මතක් කිරීමක් යැවීමට පන්තිය සහ මාසය තෝරන්න.');
      return;
    }
    if (selectedStudents.length === 0) {
      alert(isPaymentMode ? 'මෙම පන්තියේ මෙම මාසයට ගෙවීම් නොකළ ශිෂ්‍යයන් නැත.' : 'කරුණාකර අවම වශයෙන් ශිෂ්‍යයෙකු තෝරන්න.');
      return;
    }
    if (!whatsappStatus?.isReady) {
      alert('⚠️ WhatsApp සම්බන්ධ නොවේ. Dashboard → WhatsApp Connect QR scan කරන්න.');
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const res = await onSendReminder({
        student_ids: selectedStudents,
        message_type: messageType,
        custom_message: customMessage,
        // Lets the backend resolve {class_name} to the class the admin filtered by, instead
        // of guessing a student's "first" enrolled course when they're in more than one.
        course_id: selectedCourse || null,
        // Payment reminders: which month is being chased - the backend re-checks that every
        // selected student really is unpaid for it before sending.
        for_month: isPaymentMode ? selectedMonth : null,
      });
      setResult(res);
      setSelectedStudents([]);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', borderRadius: '8px',
    border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

      {/* LEFT: Student Selection */}
      <div style={{ backgroundColor: 'white', borderRadius: '15px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <h3 style={{ color: NAVY, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>👥</span> ශිෂ්‍යයන් තෝරන්න
          {selectedStudents.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '13px', backgroundColor: WHATSAPP_GREEN, color: 'white', padding: '4px 12px', borderRadius: '20px' }}>
              තෝරාගත් {selectedStudents.length}
            </span>
          )}
        </h3>

        {/* WhatsApp Status */}
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
          backgroundColor: whatsappStatus?.isReady ? '#e8f5e9' : '#fff3e0',
          border: `1px solid ${whatsappStatus?.isReady ? '#c8e6c9' : '#ffe0b2'}`,
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px'
        }}>
          <span style={{ fontSize: '20px' }}>{whatsappStatus?.isReady ? '💚' : '⚠️'}</span>
          <span style={{ color: whatsappStatus?.isReady ? '#2e7d32' : '#e65100', fontWeight: '600' }}>
            WhatsApp: {whatsappStatus?.isReady ? 'සම්බන්ධයි' : (whatsappStatus?.status || 'සම්බන්ධ නැත')}
          </span>
        </div>

        {/* Search + Course Filter */}
        <input
          type="text"
          placeholder="🔍 නමෙන් හෝ ශිෂ්‍ය අංකයෙන් සොයන්න..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, marginBottom: '10px' }}
        />
        <select value={selectedCourse} onChange={e => changeCourse(e.target.value)} style={{ ...inputStyle, marginBottom: '12px', border: isPaymentMode && !selectedCourse ? '1px solid #e65100' : inputStyle.border }}>
          <option value="">{isPaymentMode ? '📚 පන්තිය තෝරන්න (අනිවාර්යයි)' : '📚 සියලුම පන්ති'}</option>
          {courses.map(c => (
            <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
          ))}
        </select>

        {/* Payment reminders are always about one class + one month */}
        {isPaymentMode && (
          <>
            <select value={selectedMonth} onChange={e => changeMonth(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }}>
              {MONTHS.map(([en, si]) => (
                <option key={en} value={en}>📅 {si} ({en})</option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: '#555', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
              {!selectedCourse
                ? 'පන්තියක් තෝරාගත් පසු, තෝරාගත් මාසයට තවම ගෙවීම් නොකළ ශිෂ්‍යයන් පමණක් මෙහි පෙන්වයි.'
                : unpaidLoading
                  ? 'ගෙවීම් නොකළ ශිෂ්‍යයන් සොයමින්...'
                  : `${sinhalaMonth(selectedMonth)} මාසයට ගෙවීම් නොකළ ශිෂ්‍යයන් ${filteredStudents.length} දෙනෙක්. ඔවුන්ගේ මව්පියන්ට පමණක් පණිවිඩය යයි.`}
            </div>
          </>
        )}

        {/* Select All */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <button
            onClick={selectAll}
            style={{ padding: '6px 14px', backgroundColor: '#e8eaf6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: NAVY }}
          >
            {selectedStudents.length === filteredStudents.length && filteredStudents.length > 0 ? '✓ සියල්ල ඉවත් කරන්න' : '☑ සියල්ල තෝරන්න'}
          </button>
          <span style={{ fontSize: '12px', color: '#888' }}>ශිෂ්‍යයන් {filteredStudents.length}</span>
        </div>

        {/* Student List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#aaa' }}>{paymentReady ? 'මෙම මාසයට සියලු දෙනා ගෙවා ඇත 🎉' : 'ශිෂ්‍යයන් හමුවුනේ නැත'}</div>
          ) : filteredStudents.map(student => (
            <div
              key={student._id}
              onClick={() => toggleStudent(student._id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                backgroundColor: selectedStudents.includes(student._id) ? '#f0fff4' : 'white',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${WHATSAPP_GREEN}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: selectedStudents.includes(student._id) ? WHATSAPP_GREEN : 'white',
                color: 'white', fontSize: '13px', flexShrink: 0
              }}>
                {selectedStudents.includes(student._id) ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{student.name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {student.studentId} · {student.parentPhone && student.parentPhone !== 'N/A' ? `📞 ${student.parentPhone}` : '⚠️ දුරකථන අංකයක් නැත'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Message Composer + Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Message Composer */}
        <div style={{ backgroundColor: 'white', borderRadius: '15px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: NAVY, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✍️</span> පණිවිඩය සකසන්න
          </h3>

          {/* Message Type */}
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#555' }}>
            📋 පණිවිඩ වර්ගය
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { key: 'payment', label: '💰 ගෙවීම් මතක් කිරීම', color: '#e65100' },
              { key: 'exam', label: '📝 විභාග දැනුම්දීම', color: '#6a1b9a' },
              { key: 'attendance', label: '📋 පැමිණීම් දැනුම්දීම', color: '#1565c0' },
              { key: 'general', label: '📢 සාමාන්‍ය පණිවිඩය', color: '#2e7d32' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => changeMessageType(t.key)}
                style={{
                  padding: '10px', border: `2px solid ${messageType === t.key ? t.color : '#e0e0e0'}`,
                  borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: messageType === t.key ? '700' : '500',
                  backgroundColor: messageType === t.key ? `${t.color}15` : 'white',
                  color: messageType === t.key ? t.color : '#666', transition: 'all 0.2s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Custom Message Input */}
          {(messageType === 'general' || messageType === 'custom') && (
            <>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#555' }}>
                ✏️ ඔබේ පණිවිඩය
              </label>
              <textarea
                rows={4}
                placeholder="උදා: හෙට (සෙනසුරාදා) පන්තිය පැවැත්වෙන්නේ නැත."
                value={customMessage}
                onChange={(e) => { const v = filterTextInput(e.target.value); setCustomMessage(v); setMessageNotice(v !== e.target.value ? TEXT_INVALID_MSG : ''); }}
                maxLength={1000}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '0', fontFamily: 'inherit', lineHeight: '1.5' }}
              />
              {messageNotice && <p style={{ color: '#d32f2f', fontSize: '12px', margin: '4px 0 0' }}>{messageNotice}</p>}
            </>
          )}
        </div>

        {/* WhatsApp Message Preview */}
        <div style={{ backgroundColor: '#e5ddd5', borderRadius: '15px', padding: '20px', backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-light_686b98c9fdffef3f63127759e3d85da6.png")' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: '600' }}>💬 පණිවිඩය පෙනෙන ආකාරය</div>
          <div style={{
            backgroundColor: '#dcf8c6', borderRadius: '0 12px 12px 12px', padding: '12px 16px',
            maxWidth: '90%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', lineHeight: '1.6',
            whiteSpace: 'pre-wrap', fontSize: '14px', wordBreak: 'break-word'
          }}>
            {previewMessage || '(පණිවිඩය මෙහි පෙන්වයි)'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px', textAlign: 'right' }}>
            ✓✓ යවන ලදී
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || selectedStudents.length === 0}
          style={{
            padding: '16px', backgroundColor: selectedStudents.length > 0 ? WHATSAPP_GREEN : '#ccc',
            color: 'white', border: 'none', borderRadius: '12px', cursor: selectedStudents.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: selectedStudents.length > 0 ? `0 4px 20px ${WHATSAPP_GREEN}60` : 'none',
            transition: 'all 0.2s'
          }}
        >
          {sending ? (
            <><span style={{ animation: 'spin 1s linear infinite' }}>⟳</span> යවමින්...</>
          ) : (
            <>💬 WhatsApp පණිවිඩ {selectedStudents.length > 0 ? `(${selectedStudents.length}) ` : ''}යවන්න</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div style={{
            padding: '16px', borderRadius: '12px',
            backgroundColor: result.error ? '#ffebee' : '#e8f5e9',
            border: `1px solid ${result.error ? '#ffcdd2' : '#c8e6c9'}`
          }}>
            {result.error ? (
              <span style={{ color: '#c62828', fontWeight: '600' }}>❌ දෝෂයකි: {result.error}</span>
            ) : (
              <div>
                <div style={{ color: '#2e7d32', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                  ✅ WhatsApp පණිවිඩ යැවීම අවසන්!
                </div>
                <div style={{ fontSize: '13px', color: '#555' }}>
                  💬 යැවූ: <strong>{result.sent}</strong> &nbsp;|&nbsp; ❌ අසාර්ථක: <strong>{result.failed}</strong>
                  {result.skipped > 0 && <> &nbsp;|&nbsp; ⏭️ දැනටමත් ගෙවා ඇත: <strong>{result.skipped}</strong></>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

ReminderTab.propTypes = {
  students: PropTypes.array.isRequired,
  courses: PropTypes.array.isRequired,
  onSendReminder: PropTypes.func.isRequired,
  whatsappStatus: PropTypes.object,
};

export default ReminderTab;
