import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';

const SmartAttendanceLivePanel = ({ halls, activeSessions, role = 'Admin' }) => {
  const isTeacher = role === 'Teacher';
  const [sessionId, setSessionId] = useState('');
  // Hall is not chosen by hand any more - it follows the selected class schedule.
  const [liveData, setLiveData] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);

  // Teacher CCTV-access state
  const [approvedCourseIds, setApprovedCourseIds] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [requesting, setRequesting] = useState(false);

  const loadAccess = useCallback(async () => {
    if (!isTeacher) return;
    try {
      const data = await request('/cctv-access/mine');
      setApprovedCourseIds(data.approvedCourseIds || []);
      setMyRequests(data.requests || []);
    } catch { /* non-fatal */ }
  }, [isTeacher]);

  useEffect(() => { loadAccess(); }, [loadAccess]);

  const selectedSession = activeSessions.find(s => String(s.schedule_id) === String(sessionId));
  const hallId = selectedSession?.hall_id ? String(selectedSession.hall_id) : '';
  const hallName = selectedSession?.hall_name
    || halls.find(h => String(h.hall_id) === hallId)?.hall_name
    || '';
  const selectedCourseId = selectedSession?.course_id ?? null;
  const teacherApproved = !isTeacher || (selectedCourseId != null && approvedCourseIds.includes(selectedCourseId));
  const pendingReq = myRequests.find(r => r.course_id === selectedCourseId && r.status === 'Pending');

  const handleRequestAccess = async () => {
    if (!selectedCourseId) { alert('කරුණාකර පළමුව පන්තියක් තෝරන්න.'); return; }
    setRequesting(true);
    try {
      const res = await request('/cctv-access/request', { method: 'POST', body: { course_id: selectedCourseId } });
      setInfo(res.message || 'ඉල්ලීම යවන ලදී.');
      loadAccess();
    } catch (err) {
      setError(err.message || 'ඉල්ලීම යැවීම අසාර්ථකයි.');
    } finally {
      setRequesting(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Release old preview URL to avoid memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setPreviewType(file.type.startsWith('video/') ? 'video' : 'image');
    }
  };

  const handleUploadFootage = async () => {
    if (!sessionId) {
      alert('කරුණාකර පන්තිය තෝරන්න.');
      return;
    }
    if (!hallId) {
      alert('මෙම පන්තියේ කාලසටහනට ශාලාවක් නියම කර නැත. පන්ති කළමනාකරණය → කාලසටහන් වලින් ශාලාව සකසන්න.');
      return;
    }
    if (!selectedFile) {
      alert('කරුණාකර උඩුගත කිරීමට ගොනුවක් තෝරන්න.');
      return;
    }

    setUploading(true);
    setError(null);
    setInfo(null);

    const formData = new FormData();
    formData.append('cctv_footage', selectedFile);
    formData.append('session_id', sessionId);
    formData.append('hall_id', hallId);

    try {
      const response = await request('/attendance/upload-cctv', {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      
      // Backend returns: { message, data: { qr_count, ai_headcount, mismatch_detected, zone_breakdown, verification_data } }
      const resultData = response.data || response;
      const innerData = resultData.data || resultData;
      
      setLiveData({
        qr_count: innerData.qr_count ?? 0,
        ai_headcount: innerData.ai_headcount ?? 0,
        mismatch_detected: innerData.mismatch_detected ?? false,
        threshold: innerData.threshold ?? 0
      });
      
    } catch (err) {
      const msg = err.message || 'CCTV උඩුගත කිරීම අසාර්ථක විය';
      if (msg.includes('AI පද්ධතිය')) {
        setInfo('AI මුහුණු/හිසගණන සේවාව මේ මොහොතේ නොමැත (එය සක්‍රිය කළ සේවාදායකයක් අවශ්‍යයි). කරුණාකර පසුව උත්සාහ කරන්න.');
      } else if (msg.includes('අනුමැතිය අවශ්‍යයි')) {
        setInfo(msg);
        loadAccess();
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const cardStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '25px' };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={cardStyle}>
        <h3 style={{ color: '#1a237e', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
          AI පැමිණීම් නිරීක්ෂණය (AI Attendance Observation)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          <div>
            <label htmlFor="live-session-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>Session තෝරන්න</label>
            <select id="live-session-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}>
              <option value="">-- පන්තිය තෝරන්න --</option>
              {activeSessions.map(s => {
                let day = s.day_of_week;
                try { day = JSON.parse(s.day_of_week); } catch (e) {}
                if (Array.isArray(day)) day = day.join(', ');
                return <option key={s.schedule_id} value={s.schedule_id}>{s.course_name} ({day} {s.start_time}-{s.end_time})</option>;
              })}
            </select>
          </div>
          <div>
            <label htmlFor="live-hall-display" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>ශාලාව (Hall)</label>
            {/* Auto-filled from the class schedule the admin picked - no manual choice */}
            <div id="live-hall-display" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#f5f5f5', color: hallId ? '#1a237e' : '#888', fontWeight: hallId ? 'bold' : 'normal', boxSizing: 'border-box' }}>
              {!sessionId ? 'පන්තිය තෝරාගත් පසු ශාලාව ඉබේම පෙන්වයි' : hallId ? `${hallName || 'Hall #' + hallId}` : 'මෙම කාලසටහනට ශාලාවක් නියම කර නැත'}
            </div>
          </div>
        </div>

        {isTeacher && !teacherApproved ? (
          <div style={{ backgroundColor: '#fff8e1', padding: '25px', borderRadius: '10px', border: '2px dashed #f57c00', textAlign: 'center' }}>
            <h4 style={{ color: '#e65100', fontSize: '16px', marginBottom: '10px', fontWeight: 'bold' }}>CCTV දර්ශන බැලීමට පරිපාලක අනුමැතිය අවශ්‍යයි</h4>
            {!selectedCourseId ? (
              <p style={{ fontSize: '14px', color: '#666' }}>කරුණාකර පළමුව ඉහතින් පන්තියක් තෝරන්න.</p>
            ) : pendingReq ? (
              <p style={{ fontSize: '14px', color: '#e65100', fontWeight: 'bold' }}>ඔබගේ ඉල්ලීම පරිපාලක අනුමැතිය සඳහා පොරොත්තුවෙන් ඇත.</p>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                  "{selectedSession?.course_name}" පන්තියේ CCTV දර්ශන පරීක්ෂා කිරීමට පරිපාලකගෙන් අවසර ඉල්ලන්න.
                </p>
                <button onClick={handleRequestAccess} disabled={requesting}
                  style={{ padding: '12px 30px', backgroundColor: '#e65100', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                  {requesting ? '...' : 'අවසර ඉල්ලන්න (Request Access)'}
                </button>
              </>
            )}
          </div>
        ) : (
        <div style={{ backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px dashed #1a237e', textAlign: 'center' }}>
          <h4 style={{ color: '#1a237e', fontSize: '16px', marginBottom: '10px', fontWeight: 'bold' }}>CCTV ඡායාරූපය/වීඩියෝව උඩුගත කරන්න (Upload CCTV)</h4>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            පන්තියේ ලබාගත් ඡායාරූපය හෝ වීඩියෝව මෙහි උඩුගත කරන්න. AI මගින් පන්තියේ සිටින සිසුන් සංඛ්‍යාව ස්වයංක්‍රීයව ගණනය කරනු ඇත.
          </p>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <input 
              type="file" 
              accept="video/*,image/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }}
              id="cctv-upload-input"
            />
            <label 
              htmlFor="cctv-upload-input"
              style={{ padding: '12px 25px', backgroundColor: 'white', border: '1px solid #1a237e', borderRadius: '8px', color: '#1a237e', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              ගොනුවක් තෝරන්න (Select File)
            </label>
            <span style={{ fontSize: '14px', color: '#555', fontWeight: '500' }}>
              {selectedFile ? selectedFile.name : 'ගොනුවක් තෝරා නොමැත'}
            </span>
            {selectedFile && (
              <button 
                onClick={handleUploadFootage}
                disabled={uploading}
                style={{ padding: '12px 30px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 6px rgba(46,125,50,0.2)' }}
              >
                {uploading ? 'AI විශ්ලේෂණය කරමින්...' : 'AI පරීක්ෂාව අරඹන්න'}
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '20px', borderLeft: '5px solid #d32f2f' }}>
          දෝෂයකි: {error}
        </div>
      )}

      {info && (
        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', color: '#0277bd', borderRadius: '8px', marginBottom: '20px', borderLeft: '5px solid #0288d1' }}>
          {info}
        </div>
      )}

      {liveData && (
        <div style={{ ...cardStyle, borderLeft: `10px solid ${liveData.mismatch_detected ? '#d32f2f' : '#2e7d32'}`, transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h4 style={{ color: liveData.mismatch_detected ? '#c62828' : '#2e7d32', margin: 0, fontSize: '24px' }}>
              {liveData.mismatch_detected ? 'නොගැලපීමක් හඳුනාගෙන ඇත!' : 'ගැලපේ (QR සහ AI ගණන් සමානයි)'}
            </h4>
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>

            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '30px', textAlign: 'center' }}>
            <div style={{ padding: '25px', backgroundColor: '#e8eaf6', borderRadius: '12px', minWidth: '180px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '15px', color: '#3f51b5', fontWeight: 'bold', marginBottom: '10px' }}>QR ස්කෑන් ගණන (දොරටුවෙන්)</div>
              <div style={{ fontSize: '54px', fontWeight: 'bold', color: '#1a237e', lineHeight: '1' }}>{liveData.qr_count}</div>
            </div>
            <div style={{ padding: '25px', backgroundColor: '#e8eaf6', borderRadius: '12px', minWidth: '180px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '15px', color: '#3f51b5', fontWeight: 'bold', marginBottom: '10px' }}>AI මගින් ගණන් කළ සිසුන්</div>
              <div style={{ fontSize: '54px', fontWeight: 'bold', color: '#1a237e', lineHeight: '1' }}>{liveData.ai_headcount}</div>
            </div>
          </div>

          {liveData.mismatch_detected && (
            <div style={{ marginTop: '30px', padding: '25px', backgroundColor: '#ffebee', borderRadius: '10px', border: '1px solid #ef9a9a' }}>
              {liveData.ai_headcount > liveData.qr_count ? (
                <>
                  <h4 style={{ color: '#c62828', marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
                    සිසුන් QR කේතය ස්කෑන් නොකර පන්තියට ඇතුළු වී ඇත!
                  </h4>
                  <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#b71c1c', lineHeight: '1.5' }}>
                    AI මඟින් ගණනය කළ සිසුන් සංඛ්‍යාව QR පැමිණීම් වලට වඩා වැඩිය. කරුණාකර පන්තියේ සිටින සියලුම සිසුන්ට ඔවුන්ගේ QR කේතය ස්කෑන් කරන ලෙස දැනුම් දෙන්න.
                  </p>
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'qr_attendance' }));
                    }}
                    style={{ padding: '15px 30px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(26, 35, 126, 0.3)' }}
                  >
                    QR Scanner එක විවෘත කරන්න
                  </button>
                </>
              ) : (
                <>
                  <h4 style={{ color: '#c62828', marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
                    සැක සහිත පැමිණීමක් හඳුනාගෙන ඇත!
                  </h4>
                  <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#b71c1c', lineHeight: '1.5' }}>
                    QR මඟින් සටහන් වූ ගණනට වඩා පන්තියේ සිටින සිසුන් ගණන අඩුය. එනම් පන්තියට නොපැමිණි සිසුවෙකු (හෝ කිහිපදෙනෙකු) නිවසේ සිට හොරෙන් පැමිණීම (Fraud) සටහන් කර ඇත. කරුණාකර මුහුණු සත්‍යාපනය මගින් පරීක්ෂා කරන්න.
                  </p>
                  <button 
                    onClick={() => {
                      sessionStorage.setItem('verify_face_session_id', sessionId);
                      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'face-verification' }));
                    }}
                    style={{ padding: '15px 30px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(211, 47, 47, 0.3)' }}
                  >
                    මුහුණු සත්‍යාපනයට යන්න (Investigate Fraud)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MEDIA PREVIEW SECTION ─────────────────────── */}
      {previewUrl && liveData && (
        <div style={{ ...cardStyle, marginTop: '25px', textAlign: 'center' }}>
          <h4 style={{ color: '#1a237e', marginBottom: '15px', fontSize: '18px' }}>
            {previewType === 'video' ? 'උඩුගත කළ වීඩියෝව' : 'උඩුගත කළ ඡායාරූපය'}
          </h4>
          <div style={{ display: 'inline-block', border: '2px solid #ddd', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#000' }}>
            {previewType === 'video' ? (
              <video 
                src={previewUrl} 
                controls 
                autoPlay 
                muted 
                loop
                style={{ maxWidth: '100%', maxHeight: '400px', display: 'block' }} 
              />
            ) : (
              <img 
                src={previewUrl} 
                alt="Uploaded CCTV Preview" 
                style={{ maxWidth: '100%', maxHeight: '400px', display: 'block' }} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

SmartAttendanceLivePanel.propTypes = {
  halls: PropTypes.array.isRequired,
  activeSessions: PropTypes.array.isRequired,
  role: PropTypes.string,
};

export default SmartAttendanceLivePanel;
