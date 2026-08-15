import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { Camera, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

const FaceVerificationTab = ({ activeSessions, students }) => {
  const [sessionId, setSessionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Filter students based on selected session's course
  const [filteredStudents, setFilteredStudents] = useState([]);

  // Auto-fill from redirect session/student
  useEffect(() => {
    const savedSessionId = sessionStorage.getItem('verify_face_session_id');
    const savedStudentId = sessionStorage.getItem('verify_face_student_id');
    if (savedSessionId) {
      setSessionId(savedSessionId);
      sessionStorage.removeItem('verify_face_session_id');
    }
    if (savedStudentId) {
      setStudentId(savedStudentId);
      sessionStorage.removeItem('verify_face_student_id');
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      const session = activeSessions.find(s => s.schedule_id === Number(sessionId));
      if (session) {
        // Fetch students enrolled in this course or who scanned QR today
        const getAttendingStudents = async () => {
          try {
            setError(null);
            // Fetch logs for today for this course to see who scanned QR
            const logs = await request(`/attendance/logs/${session.course_id}`);
            // Filter to students who have scanned but not face-verified yet
            const unverified = logs.filter(log => !log.is_face_verified);
            setFilteredStudents(unverified);
          } catch (err) {
            console.error("Error loading attending students:", err);
            // Fallback to all students enrolled
            setFilteredStudents([]);
          }
        };
        getAttendingStudents();
      }
    } else {
      setFilteredStudents([]);
    }
  }, [sessionId, activeSessions]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    setResult(null);
    setPhoto(null);

    // navigator.mediaDevices only exists in a "secure context" (HTTPS, or http://localhost).
    // This app is also served over the LAN IP (for phone QR scanning), and opening the
    // dashboard from that IP over plain HTTP silently leaves mediaDevices undefined -
    // calling .getUserMedia on it then throws instead of hitting the catch block below.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        window.isSecureContext
          ? "මෙම උපාංගය/බ්‍රවුසරය කැමරාවට සහාය නොදක්වයි."
          : "කැමරාවට ප්‍රවේශය සඳහා මෙම පිටුව http://localhost:5173 හරහා විවෘත කළ යුතුයි (දැනට IP ලිපිනයකින් හෝ HTTPS නොමැතිව විවෘත කර ඇත)."
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Webcam access error:", err);
      setError("කැමරාව ක්‍රියාත්මක කිරීමට නොහැකි විය. කරුණාකර අවසර (Permissions) ලබා දී ඇති දැයි බලන්න.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleVerify = async () => {
    if (!sessionId) return alert('කරුණාකර පන්තිය තෝරන්න.');
    if (!studentId) return alert('කරුණාකර ශිෂ්‍යයා තෝරන්න.');
    if (!photo) return alert('කරුණාකර මුහුණේ ඡායාරූපයක් ලබාගන්න.');

    setVerifying(true);
    setError(null);
    setResult(null);

    try {
      const response = await request('/attendance/verify-face', {
        method: 'POST',
        body: {
          student_id: Number(studentId),
          session_id: Number(sessionId),
          image_data: photo
        }
      });
      setResult({ success: true, message: response.message });
      // Dispatch event so SmartAttendanceLivePanel can update annotated CCTV image
      window.dispatchEvent(new CustomEvent('faceVerifySuccess', {
        detail: {
          session_id: Number(sessionId),
          student_id: Number(studentId),
          annotated_image_url: response.annotated_image_url || null
        }
      }));
      // Remove verified student from list
      setFilteredStudents(prev => prev.filter(s => s.student_id !== Number(studentId)));
      setStudentId('');
      setPhoto(null);

    } catch (err) {
      setError(err.message || 'මුහුණු සත්‍යාපනය අසාර්ථකයි.');
      setResult({ success: false });
    } finally {
      setVerifying(false);
    }
  };

  const handleMarkFraud = async () => {
    if (!sessionId) return;
    if (filteredStudents.length === 0) return;
    
    if (!window.confirm(`සිසුන් ${filteredStudents.length} දෙනෙකු හොරෙන් පැමිණීම (Fraud) සටහන් කර ඇති බව තහවුරු කරනවාද?`)) {
      return;
    }

    try {
      const response = await request('/attendance/mark-fraud', {
        method: 'POST',
        body: {
          session_id: Number(sessionId),
          unverified_student_ids: filteredStudents.map(s => s.student_id)
        }
      });
      setResult({ success: true, message: response.message || 'හොර පැමිණීම් සාර්ථකව සටහන් කරන ලදී.' });
      setFilteredStudents([]); // Clear the list
    } catch (err) {
      setError(err.message || 'ක්‍රියාවලිය අසාර්ථකයි.');
    }
  };

  const cardStyle = {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(31, 38, 135, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    marginBottom: '20px'
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={cardStyle}>
        <h3 style={{ color: '#1a237e', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          <ShieldCheck size={24} className="text-primary" />
          🧬 මුහුණු සත්‍යාපන අංශය (Face Verification Panel)
        </h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '25px' }}>
          පැමිණීමේ විසංවාදයක් (Mismatch) ඇති වූ විට, පන්තියේ සිටින ශිෂ්‍යයාගේ අනන්‍යතාවය වෙබ් කැමරාව මඟින් සත්‍යාපනය කිරීමට මෙම පිටුව භාවිතා කරන්න.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label htmlFor="verify-session-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Session තෝරන්න</label>
            <select
              id="verify-session-select"
              value={sessionId}
              onChange={(e) => { setSessionId(e.target.value); stopCamera(); setPhoto(null); setResult(null); setError(null); }}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
            >
              <option value="">-- පන්තිය තෝරන්න --</option>
              {activeSessions.map(s => (
                <option key={s.schedule_id} value={s.schedule_id}>
                  {s.course_name} ({s.day_of_week} {s.start_time}-{s.end_time})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="verify-student-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>ශිෂ්‍යයා තෝරන්න (Awaiting Verification)</label>
            <select
              id="verify-student-select"
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value); setResult(null); setError(null); }}
              disabled={!sessionId}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
            >
              <option value="">-- ශිෂ්‍යයා තෝරන්න --</option>
              {filteredStudents.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.student_id} - {s.student_name}
                </option>
              ))}
            </select>
            {sessionId && filteredStudents.length === 0 && (
              <span style={{ fontSize: '12px', color: '#2e7d32', marginTop: '5px', display: 'block' }}>
                🎉 සියලුම සිසුන් සත්‍යාපනය වී ඇත!
              </span>
            )}
          </div>
        </div>

        {/* Webcam Area */}
        {studentId && (
          <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>

            {/* Camera Viewport */}
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: '480px',
              aspectRatio: '4/3',
              backgroundColor: '#1e1e24',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
              />
              {photo && (
                <img
                  src={photo}
                  alt="Captured face"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              {!cameraActive && !photo && (
                <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                  <Camera size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>කැමරාව අක්‍රියයි.</p>
                </div>
              )}
            </div>

            {/* Camera Actions */}
            <div style={{ display: 'flex', gap: '15px' }}>
              {!cameraActive && (
                <button
                  onClick={startCamera}
                  style={{ padding: '12px 24px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Camera size={18} /> කැමරාව ක්‍රියාත්මක කරන්න (Start Camera)
                </button>
              )}
              {cameraActive && (
                <button
                  onClick={capturePhoto}
                  style={{ padding: '12px 24px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  📸 ඡායාරූපය ගන්න (Capture Face)
                </button>
              )}
              {photo && (
                <button
                  onClick={startCamera}
                  style={{ padding: '12px 24px', backgroundColor: '#455a64', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <RefreshCw size={18} /> නැවත ගන්න (Retake)
                </button>
              )}
            </div>

            {/* Verification Trigger */}
            {photo && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                style={{ width: '100%', maxWidth: '480px', padding: '15px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px', boxShadow: '0 4px 10px rgba(46, 125, 50, 0.2)' }}
              >
                {verifying ? 'මුහුණ පරීක්ෂා කරමින්...' : '🧬 අනන්‍යතාවය තහවුරු කරන්න (Verify Identity)'}
              </button>
            )}
          </div>
        )}

        {/* Mark Fraud Button for remaining students */}
        {sessionId && filteredStudents.length > 0 && !photo && (
          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#ffebee', borderRadius: '12px', border: '1px solid #ef9a9a', textAlign: 'center' }}>
            <h4 style={{ color: '#c62828', marginTop: 0, marginBottom: '10px' }}>⚠️ සත්‍යාපනය අවසන් කරන්න</h4>
            <p style={{ fontSize: '14px', color: '#b71c1c', marginBottom: '15px' }}>
              පන්තියේ සිටින සියලුම සිසුන් සත්‍යාපනය කර අවසන්ද? තවමත් ලැයිස්තුවේ සිසුන් {filteredStudents.length} ක් ඉතිරි වී ඇත. ඔවුන් නිවසේ සිට QR ස්කෑන් කළ සිසුන් (Fraud) ලෙස සලකා පද්ධතියේ සටහන් කරන්න.
            </p>
            <button
              onClick={handleMarkFraud}
              style={{ padding: '12px 24px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <AlertTriangle size={18} /> සත්‍යාපනය අවසන් කරන්න (Mark Remaining as Fraud)
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '5px solid #d32f2f' }}>
            <AlertTriangle size={20} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{error}</span>
          </div>
        )}

        {result && result.success && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '5px solid #2e7d32' }}>
            <CheckCircle size={20} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{result.message}</span>
          </div>
        )}

        {/* Hidden canvas for image capturing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

FaceVerificationTab.propTypes = {
  activeSessions: PropTypes.array.isRequired,
  students: PropTypes.array.isRequired
};

export default FaceVerificationTab;
