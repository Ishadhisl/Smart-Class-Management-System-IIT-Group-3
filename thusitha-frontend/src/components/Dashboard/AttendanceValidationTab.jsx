import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { request } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AttendanceValidationTab = ({ halls, activeSessions, onSendAlert, onBulkNotify, onVerifyFace }) => {
  const [sessionId, setSessionId] = useState('');
  const [hallId, setHallId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [steps, setSteps] = useState([]);

  const handleValidate = async () => {
    if (!sessionId || !hallId) return alert('කරුණාකර Session සහ Hall තෝරන්න.');
    setLoading(true);
    setResult(null);
    setSteps([]);

    const addStep = (msg, delay) => {
      return new Promise(resolve => {
        setTimeout(() => {
          setSteps(prev => [...prev, msg]);
          resolve();
        }, delay);
      });
    };

    try {
      await addStep("🎥 Step 1: Connecting to hall CCTV camera streams...", 500);
      await addStep("📸 Step 2: Grabbing active frame snapshot...", 800);
      await addStep("🔍 Step 3: Running YOLOv8 human headcount detection...", 800);

      const response = await request('/attendance/validate-hall', {
        method: 'POST',
        body: { session_id: sessionId, hall_id: hallId }
      });

      const resData = response.data;
      await addStep(`📊 Step 4: Comparing AI headcount (${resData.ai_headcount}) with door scans (${resData.qr_count})...`, 600);

      if (resData.mismatch_detected) {
        await addStep("⚠️ Step 5: Headcount discrepancy detected (exceeds threshold)!", 600);
        await addStep("🚨 Step 6: Activating Biometrics pipeline & extracting face encodings...", 800);
        await addStep("🧬 Step 7: Performing face recognition against expected student vectors...", 1000);
      } else {
        await addStep("✅ Step 5: Headcount matches door records. Skipping biometric pass.", 600);
      }

      await addStep("🏁 Step 8: Verification report compiled successfully!", 400);
      setResult(resData);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!result?.verification_data?.unverified_students) return;
    
    const headers = ["Student ID", "Name"];
    const rows = result.verification_data.unverified_students.map(s => [s.id, s.name]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Discrepancy_Report_Session_${sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getBase64ImageFromUrl = async (url) => {
    try {
      const data = await fetch(url, { mode: 'cors' });
      const blob = await data.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
      });
    } catch (e) {
      console.error("Error loading image for PDF conversion:", e);
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    const doc = new jsPDF();
    const session = activeSessions.find(s => s.schedule_id === Number(sessionId));
    const sessionName = session?.course_name || 'N/A';
    const hall = halls.find(h => h.hall_id === Number(hallId));
    const hallName = hall?.hall_name || 'N/A';

    // Header
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text('Thusitha Smart Class - Session Attendance Report', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Session: ${sessionName}`, 14, 30);
    doc.text(`Hall: ${hallName}`, 14, 37);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 44);

    // Summary
    doc.setTextColor(0);
    doc.text(`Door (QR) Scans: ${result.qr_count}`, 14, 55);
    doc.text(`AI Headcount: ${result.ai_headcount}`, 14, 62);
    doc.text(`Validation Result: ${result.mismatch_detected ? 'Mismatch Detected ⚠️' : 'Verified ✅'}`, 14, 69);

    // Zone Breakdown
    const zoneTableData = Object.entries(result.zone_breakdown).map(([name, count]) => [name, count]);
    autoTable(doc, {
      head: [["Zone Name", "Headcount"]],
      body: zoneTableData,
      startY: 75,
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126] }
    });

    let currentY = doc.lastAutoTable.finalY + 15;

    // Load and embed CCTV snapshot images in the PDF report
    for (const [zoneName, count] of Object.entries(result.zone_breakdown)) {
      const zoneData = result.verification_data?.zone_details?.[zoneName];
      if (zoneData && zoneData.image_url) {
        const imageUrl = `${API_BASE}/${zoneData.image_url}`;
        const base64Img = await getBase64ImageFromUrl(imageUrl);
        if (base64Img) {
          if (currentY + 115 > 285) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFontSize(12);
          doc.setTextColor(26, 35, 126);
          doc.text(`CCTV Zone Snapshot: ${zoneName}`, 14, currentY);
          // 16:9 aspect ratio scaling (180mm x 101.25mm)
          doc.addImage(base64Img, 'JPEG', 14, currentY + 5, 180, 101.25);
          currentY += 115;
        }
      }
    }

    // Unverified Students
    if (result.verification_data?.unverified_students?.length > 0) {
      if (currentY + 30 > 285) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(197, 48, 48);
      doc.text('Unverified Students (Discrepancy List)', 14, currentY);
      const unverifiedTableData = result.verification_data.unverified_students.map(s => [s.id, s.name]);
      autoTable(doc, {
        head: [["Student ID", "Student Name"]],
        body: unverifiedTableData,
        startY: currentY + 5,
        theme: 'grid',
        headStyles: { fillColor: [197, 48, 48] }
      });
    }

    doc.save(`Session_Report_${sessionName.replace(/\s+/g, '_')}.pdf`);
  };

  const cardStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '20px' };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={cardStyle}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>🛡️ AI Zoned Headcount Validation</h3>
        <p style={{ fontSize: '14px', color: '#666' }}>මෙමගින් ශාලාවේ එක් එක් කලාප (Zones) වල සිටින සිසුන් ගණන QR දත්ත සමඟ සැසඳීම සිදු කරයි.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label htmlFor="session-select" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Session තෝරන්න</label>
            <select id="session-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}>
              <option value="">-- පන්තිය තෝරන්න --</option>
              {activeSessions.map(s => <option key={s.schedule_id} value={s.schedule_id}>{s.course_name} ({s.day_of_week} {s.start_time}-{s.end_time})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="hall-select" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශාලාව (Hall) තෝරන්න</label>
            <select id="hall-select" value={hallId} onChange={(e) => setHallId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}>
              <option value="">-- ශාලාවක් තෝරන්න --</option>
              {halls.map(h => <option key={h.hall_id} value={h.hall_id}>{h.hall_name}</option>)}
            </select>
          </div>
        </div>

        <button 
          onClick={handleValidate} 
          disabled={loading}
          style={{ width: '100%', padding: '15px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'කලාපීය දත්ත පරීක්ෂා කරමින්...' : 'කලාපීය පැමිණීම පරීක්ෂා කරන්න (Validate Zones)'}
        </button>
      </div>

      {loading && steps.length > 0 && (
        <div style={{ ...cardStyle, borderLeft: '10px solid #1a237e', backgroundColor: '#f5f7fb' }}>
          <h4 style={{ color: '#1a237e', marginTop: 0, marginBottom: '15px' }}>🤖 Processing AI Validation Steps...</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: 'white', 
                  borderRadius: '6px', 
                  borderLeft: '4px solid #1a237e',
                  fontSize: '14px',
                  fontWeight: idx === steps.length - 1 ? 'bold' : 'normal',
                  animation: idx === steps.length - 1 ? 'pulse-step 1s infinite alternate' : 'none'
                }}
              >
                {step}
              </div>
            ))}
          </div>
          <style>{`
            @keyframes pulse-step {
              from { opacity: 0.6; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {result && (
        <div style={{ ...cardStyle, borderLeft: `10px solid ${result.mismatch_detected ? '#f44336' : '#4caf50'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ color: result.mismatch_detected ? '#d32f2f' : '#2e7d32', margin: 0 }}>
              {result.mismatch_detected ? '⚠️ Attendance Discrepancy Found' : '✅ Attendance Verified'}
            </h4>
            <button 
              onClick={handleDownloadPDF}
              style={{ padding: '8px 15px', backgroundColor: '#455a64', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              🖨️ PDF Report
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '18px' }}>
            <div>QR Scans: <strong>{result.qr_count}</strong></div>
            <div>AI Count: <strong>{result.ai_headcount}</strong></div>
          </div>

          <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
            <h5 style={{ marginTop: 0, marginBottom: '15px' }}>📷 Zone Breakdown (Headcount per Camera):</h5>
            {Object.entries(result.zone_breakdown).map(([name, count]) => {
              const details = result.verification_data?.zone_details?.[name];
              const imageUrl = details?.image_url;
              return (
                <div key={name} style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ fontWeight: '500' }}>{name}</span>
                    <span style={{ fontWeight: 'bold', color: '#1a237e' }}>{count} Students</span>
                  </div>
                  {imageUrl && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#555', fontWeight: '500' }}>📸 Captured Snapshot for Verification:</p>
                      <img 
                        src={`${API_BASE}/${imageUrl}`} 
                        alt={`Snapshot for ${name}`} 
                        style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#f0f0f0' }} 
                      />
                      {details.status === "offline" ? (
                        <div style={{ fontSize: '12px', color: '#c53030', marginTop: '8px', backgroundColor: '#fff5f5', padding: '8px', borderRadius: '4px', border: '1px solid #feb2b2', fontWeight: '500' }}>
                          ⚠️ Biometric Verification Engine is offline on this server. Snapshot saved for manual review.
                        </div>
                      ) : (
                        details.total_faces_found !== undefined && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', display: 'flex', gap: '15px', backgroundColor: 'white', padding: '8px', borderRadius: '4px', border: '1px solid #eee' }}>
                            <span>Faces Detected: <strong>{details.total_faces_found}</strong></span>
                            <span>Matched (Present): <strong>{details.matched_student_ids?.length || 0}</strong></span>
                            <span>Unknown: <strong>{details.unknown_faces_count || 0}</strong></span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {result.verification_data?.unverified_students?.length > 0 && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                 <h5 style={{ margin: 0, color: '#c53030' }}>🚫 හඳුනාගත නොහැකි වූ සිසුන් (Unverified Students):</h5>
                 <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => onBulkNotify(result.verification_data.unverified_students.map(s => s.id), sessionId)}
                      style={{ padding: '6px 12px', backgroundColor: '#c53030', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      🔔 Notify All Parents
                    </button>
                    <button 
                      onClick={handleDownloadCSV}
                      style={{ padding: '6px 12px', backgroundColor: '#4a5568', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      📥 Download CSV
                    </button>
                 </div>
               </div>
               <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>පැමිණීම සටහන් කළ නමුත් කැමරාව මගින් හඳුනාගත නොහැකි වූ සිසුන්:</p>
               <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                 {result.verification_data.unverified_students.map(s => (
                   <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px' }}>
                     <span><strong>{s.id}</strong> - {s.name}</span>
                     <div style={{ display: 'flex', gap: '8px' }}>
                       {onVerifyFace && (
                         <button 
                           onClick={() => onVerifyFace(s.id, sessionId)}
                           style={{ padding: '6px 12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                         >
                           🧬 Verify Face
                         </button>
                       )}
                       <button 
                         onClick={() => onSendAlert(s.id, sessionId)}
                         style={{ padding: '6px 12px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                       >
                         🔔 Notify Parent
                       </button>
                     </div>
                   </li>
                 ))}
               </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AttendanceValidationTab.propTypes = {
  halls: PropTypes.array.isRequired,
  activeSessions: PropTypes.array.isRequired,
  onSendAlert: PropTypes.func.isRequired,
  onBulkNotify: PropTypes.func.isRequired,
  onVerifyFace: PropTypes.func
};

export default AttendanceValidationTab;