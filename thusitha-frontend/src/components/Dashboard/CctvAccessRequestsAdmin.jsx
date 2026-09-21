import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

// Admin-only card shown on the home dashboard: teachers' pending requests to view a
// class's CCTV footage. Self-hides when there is nothing pending.
const CctvAccessRequestsAdmin = () => {
  const { showNotification } = useNotification();
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request('/cctv-access/pending');
      setPending(Array.isArray(data) ? data : []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (id, decision) => {
    setBusyId(id);
    try {
      await request(`/cctv-access/${id}/decide`, { method: 'POST', body: { decision } });
      showNotification(decision === 'Approved' ? 'අනුමත කරන ලදී.' : 'ප්‍රතික්ෂේප කරන ලදී.', decision === 'Approved' ? 'success' : 'info');
      setPending((p) => p.filter((r) => r.request_id !== id));
    } catch (err) {
      showNotification(err.message || 'ක්‍රියාව අසාර්ථකයි.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (dismissed || pending.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderLeft: '6px solid #f57c00',
      borderRadius: '12px', padding: '18px 20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(245,124,0,0.12)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ color: '#e65100', fontSize: '15px' }}>
          CCTV දර්ශන බැලීමට ගුරුවරුන්ගේ ඉල්ලීම් ({pending.length})
        </strong>
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '18px', display: 'inline-flex' }}><X size={18} /></button>
      </div>
      {pending.map((r) => (
        <div key={r.request_id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          padding: '10px 0', borderTop: '1px solid #ffe0b2', flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '14px', color: '#5d4037' }}>
            <b>{r.teacher_name || 'ගුරුවරයා'}</b> — "{r.course_name || `Course ${r.course_id}`}" පන්තියේ CCTV දර්ශන බැලීමට ඉල්ලයි
            {r.note ? <span style={{ color: '#8d6e63' }}> — "{r.note}"</span> : null}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => decide(r.request_id, 'Approved')} disabled={busyId === r.request_id}
              style={{ padding: '7px 16px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              අනුමත කරන්න
            </button>
            <button onClick={() => decide(r.request_id, 'Denied')} disabled={busyId === r.request_id}
              style={{ padding: '7px 16px', backgroundColor: '#c62828', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              ප්‍රතික්ෂේප
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CctvAccessRequestsAdmin;
