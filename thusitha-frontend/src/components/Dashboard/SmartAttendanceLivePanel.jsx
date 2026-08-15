import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';

const SmartAttendanceLivePanel = ({ halls, activeSessions }) => {
  const [sessionId, setSessionId] = useState('');
  const [hallId, setHallId] = useState('');
  const [liveData, setLiveData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);

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
    if (!sessionId || !hallId) {
      alert('කරුණාකර Session සහ Hall තෝරන්න.');
      return;
    }
    if (!selectedFile) {
      alert('කරුණාකර උඩුගත කිරීමට ගොනුවක් තෝරන්න.');
      return;
    }

    setUploading(true);
    setError(null);

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
      setError(err.message || 'CCTV upload failed');
    } finally {
      setUploading(false);
    }
  };

  const cardStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '25px' };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={cardStyle}>
        <h3 style={{ color: '#1a237e', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
          📷 AI පැමිණීම් නිරීක්ෂණය (AI Attendance Observation)
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
            <label htmlFor="live-hall-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>ශාලාව (Hall) තෝරන්න</label>
            <select id="live-hall-select" value={hallId} onChange={(e) => setHallId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}>
              <option value="">-- ශාලාවක් තෝරන්න --</option>
              {halls.map(h => <option key={h.hall_id} value={h.hall_id}>{h.hall_name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px dashed #1a237e', textAlign: 'center' }}>
          <h4 style={{ color: '#1a237e', fontSize: '16px', marginBottom: '10px', fontWeight: 'bold' }}>📤 CCTV ඡායාරූපය/වීඩියෝව උඩුගත කරන්න (Upload CCTV)</h4>
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
              📂 ගොනුවක් තෝරන්න (Select File)
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
                {uploading ? 'Processing AI...' : '🚀 AI පරීක්ෂාව අරඹන්න'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '20px', borderLeft: '5px solid #d32f2f' }}>
          ⚠️ දෝෂයකි: {error}
        </div>
      )}

      {liveData && (
        <div style={{ ...cardStyle, borderLeft: `10px solid ${liveData.mismatch_detected ? '#d32f2f' : '#2e7d32'}`, transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h4 style={{ color: liveData.mismatch_detected ? '#c62828' : '#2e7d32', margin: 0, fontSize: '24px' }}>
              {liveData.mismatch_detected ? '⚠️ Mismatch Detected!' : '✅ Synchronized (MATCH)'}
            </h4>
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>
              <div>Threshold: ±{liveData.threshold || 5} students</div>
              <div>Last updated: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '30px', textAlign: 'center' }}>
            <div style={{ padding: '25px', backgroundColor: '#e8eaf6', borderRadius: '12px', minWidth: '180px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '15px', color: '#3f51b5', fontWeight: 'bold', marginBottom: '10px' }}>DOOR SCANS (QR Count)</div>
              <div style={{ fontSize: '54px', fontWeight: 'bold', color: '#1a237e', lineHeight: '1' }}>{liveData.qr_count}</div>
            </div>
            <div style={{ padding: '25px', backgroundColor: '#e8eaf6', borderRadius: '12px', minWidth: '180px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '15px', color: '#3f51b5', fontWeight: 'bold', marginBottom: '10px' }}>AI HEADCOUNT</div>
              <div style={{ fontSize: '54px', fontWeight: 'bold', color: '#1a237e', lineHeight: '1' }}>{liveData.ai_headcount}</div>
            </div>
          </div>

          {liveData.mismatch_detected && (
            <div style={{ marginTop: '30px', padding: '25px', backgroundColor: '#ffebee', borderRadius: '10px', border: '1px solid #ef9a9a' }}>
              {liveData.ai_headcount > liveData.qr_count ? (
                <>
                  <h4 style={{ color: '#c62828', marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
                    ⚠️ සිසුන් QR කේතය ස්කෑන් නොකර පන්තියට ඇතුළු වී ඇත!
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
                    📲 QR Scanner එක විවෘත කරන්න (Open QR Scanner)
                  </button>
                </>
              ) : (
                <>
                  <h4 style={{ color: '#c62828', marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
                    ⚠️ සැක සහිත පැමිණීමක් හඳුනාගෙන ඇත!
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
                    🔍 මුහුණු සත්‍යාපනයට යන්න (Investigate Fraud)
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
            {previewType === 'video' ? '📹 Uploaded Video' : '📷 Uploaded Image'}
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
};

export default SmartAttendanceLivePanel;
