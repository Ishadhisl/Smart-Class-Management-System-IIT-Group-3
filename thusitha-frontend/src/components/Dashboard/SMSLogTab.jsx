import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Doughnut } from 'react-chartjs-2';
import QRCode from 'qrcode';
import { request } from '../../services/api';

const SMSLogTab = ({ logs, onResend, onDelete, onBulkResend, onResendFilteredFailed, whatsappStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [bulkDate, setBulkDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [qrCodeImg, setQrCodeImg] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  // isReady overrides visibility directly (derived, not synced via effect) so a successful
  // pairing dismisses the modal the moment the next status poll observes it.
  const qrModalVisible = showQrModal && !whatsappStatus.isReady;

  const [reconnecting, setReconnecting] = useState(false);
  const [qrStatusText, setQrStatusText] = useState('');

  // Open the modal immediately and let the polling effect fill in the QR — a single
  // fetch often lands in the gap between socket cycles when qrCodeData is momentarily null.
  const openQrModal = () => {
    setQrCodeImg(null);
    setQrStatusText('QR කේතය ලබා ගනිමින්...');
    setShowQrModal(true);
  };

  const pollQr = async () => {
    try {
      const res = await request('/sms/whatsapp-qr');
      if (res.isReady) {
        setShowQrModal(false);
        return true;
      }
      if (res.hasQr && res.qr) {
        setQrCodeImg(await QRCode.toDataURL(res.qr));
        setQrStatusText('');
        return true;
      }
      setQrStatusText(res.message || 'QR කේතය සෑදෙමින් පවතී — මොහොතක් රැඳී සිටින්න...');
      return false;
    } catch {
      setQrStatusText('QR ලබාගැනීමේ දෝෂයක් — නැවත උත්සාහ කරමින්...');
      return false;
    }
  };

  // Ask the backend to spin up a fresh Baileys socket (resets the retry cap) so a new
  // QR is generated — the recovery path when auto-reconnect has given up, without a redeploy.
  const handleReconnect = async () => {
    setReconnecting(true);
    openQrModal();
    try {
      await request('/sms/whatsapp-reconnect', { method: 'POST' });
    } catch (e) {
      setQrStatusText('නැවත සම්බන්ධ කිරීම අසාර්ථකයි: ' + e.message);
    } finally {
      setReconnecting(false);
    }
  };

  // While the modal is open: poll every 3s. If no QR after ~15s, trigger a reconnect once.
  useEffect(() => {
    if (!qrModalVisible) return undefined;
    let tries = 0;
    let reconnectTried = false;
    pollQr();
    const interval = setInterval(async () => {
      tries += 1;
      const got = await pollQr();
      if (!got && !reconnectTried && tries >= 5) {
        reconnectTried = true;
        setQrStatusText('QR කේතයක් නැත — නැවත සම්බන්ධ වෙමින්...');
        request('/sms/whatsapp-reconnect', { method: 'POST' }).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [qrModalVisible]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.parent_phone?.includes(searchTerm);
    const matchesStatus = statusFilter === 'All' || log.whatsapp_status === statusFilter || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const failedFilteredLogs = filteredLogs.filter(log => log.whatsapp_status === 'Failed' || log.status === 'Failed');

  // 📊 Stats
  const sentCount   = logs.filter(l => l.whatsapp_status === 'Sent' || l.status === 'Sent').length;
  const failedCount = logs.filter(l => (l.whatsapp_status === 'Failed' || l.status === 'Failed') && l.whatsapp_status !== 'Sent').length;
  const totalCount  = logs.length;
  const successRate = totalCount > 0 ? ((sentCount / totalCount) * 100).toFixed(1) : 100;

  const chartData = {
    labels: ['✅ Sent', '❌ Failed'],
    datasets: [{
      data: [sentCount, failedCount],
      backgroundColor: ['#25d366', '#d32f2f'],
      hoverOffset: 4,
    }],
  };

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '10px',
    borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px'
  };

  const statusDot = (status) => {
    if (!status || status === 'Not Sent') return { bg: '#f5f5f5', color: '#999', label: '➖ Not Sent' };
    if (status === 'Sent') return { bg: '#e8f5e9', color: '#2e7d32', label: '✅ Sent' };
    return { bg: '#ffebee', color: '#d32f2f', label: '❌ Failed' };
  };

  const waStatusStyle = (status) => {
    const s = statusDot(status);
    return (
      <span style={{
        padding: '4px 10px', borderRadius: '12px', fontSize: '11px',
        fontWeight: 'bold', backgroundColor: s.bg, color: s.color,
        border: `1px solid ${s.bg}`, display: 'inline-block'
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      
      {/* 📱 WhatsApp Connection Status Banner */}
      {whatsappStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px',
          backgroundColor: whatsappStatus.isReady ? '#e8f5e9' : whatsappStatus.hasQr ? '#fff3e0' : '#ffebee',
          borderRadius: '12px', marginBottom: '20px',
          border: `1px solid ${whatsappStatus.isReady ? '#c8e6c9' : whatsappStatus.hasQr ? '#ffe0b2' : '#ffcdd2'}`
        }}>
          <span style={{ fontSize: '28px' }}>
            {whatsappStatus.isReady ? '💚' : whatsappStatus.hasQr ? '📲' : '🔴'}
          </span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
              WhatsApp: {whatsappStatus.status}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {whatsappStatus.isReady
                ? 'WhatsApp සාර්ථකව සම්බන්ධ වී ඇත. Messages send කළ හැකිය.'
                : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span>{whatsappStatus.hasQr ? '📲 QR Code එක scan කරන්න.' : 'WhatsApp සම්බන්ධ නොවේ.'}</span>
                    <button onClick={openQrModal} style={{ padding: '5px 12px', backgroundColor: '#f57c00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                      QR Code පෙන්වන්න
                    </button>
                    <button onClick={handleReconnect} disabled={reconnecting} style={{ padding: '5px 12px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '6px', cursor: reconnecting ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                      {reconnecting ? '...' : '🔄 නැවත සම්බන්ධ කරන්න'}
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* 📱 How to link the institute phone */}
      {whatsappStatus && !whatsappStatus.isReady && (
        <details style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', color: '#334155' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#1a237e' }}>📱 ආයතනයේ දුරකථනය සම්බන්ධ කරන ආකාරය</summary>
          <ol style={{ margin: '10px 0 0 0', paddingLeft: '20px', lineHeight: '1.9' }}>
            <li>ඉහත <b>“QR Code පෙන්වන්න”</b> ඔබන්න. (QR එකක් නොපෙනේ නම් පළමුව <b>“නැවත සම්බන්ධ කරන්න”</b>.)</li>
            <li>ආයතනයේ දුරකථනයේ <b>WhatsApp</b> විවෘත කරන්න.</li>
            <li><b>Settings → Linked Devices → Link a Device</b> වෙත යන්න.</li>
            <li>මෙම තිරයේ පෙන්වන QR Code එක එම දුරකථනයෙන් scan කරන්න.</li>
            <li>තත්ත්වය <b>💚 Connected</b> බවට පත් වූ පසු පණිවිඩ යැවිය හැක.</li>
          </ol>
          <p style={{ margin: '10px 0 0 0', color: '#64748b' }}>
            සම්බන්ධතාවය සේවාදායකය නැවත deploy වන තුරු පවතී. එය ස්ථිර කිරීමට backend එකට
            persistent disk එකක් අවශ්‍ය වේ (deploy/DEPLOY.md බලන්න).
          </p>
        </details>
      )}

      <h3 style={{ color: '#1a237e', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>💬</span> WhatsApp වාර්තා සහ කාර්ය සාධනය
      </h3>

      {/* 📈 Stats Section */}
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', marginBottom: '30px', padding: '25px', backgroundColor: '#f8fafc', borderRadius: '15px', alignItems: 'center' }}>
        <div style={{ width: '160px', height: '160px' }}>
          <Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
        </div>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            WhatsApp Delivery Rate
          </div>
          <div style={{ fontSize: '52px', fontWeight: '900', color: Number.parseFloat(successRate) > 90 ? '#25d366' : '#f57c00', lineHeight: '1' }}>
            {successRate}%
          </div>
          <div style={{ display: 'flex', gap: '30px', marginTop: '20px' }}>
            <div style={{ borderLeft: '5px solid #25d366', paddingLeft: '15px' }}>
              <small style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>💬 Sent:</small>
              <div style={{ fontWeight: '800', fontSize: '22px', color: '#1e293b' }}>{sentCount}</div>
            </div>
            <div style={{ borderLeft: '5px solid #d32f2f', paddingLeft: '15px' }}>
              <small style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>❌ Failed:</small>
              <div style={{ fontWeight: '800', fontSize: '22px', color: '#1e293b' }}>{failedCount}</div>
            </div>
            <div style={{ borderLeft: '5px solid #1565c0', paddingLeft: '15px' }}>
              <small style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>📊 Total:</small>
              <div style={{ fontWeight: '800', fontSize: '22px', color: '#1e293b' }}>{totalCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 Filters */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: 2, minWidth: '250px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>🔍 සෙවීම</label>
          <input
            type="text"
            placeholder="මව්පිය නම හෝ දුරකථන අංකයෙන් සොයන්න..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>⚙️ Status Filter</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="All">සියල්ල (All)</option>
            <option value="Sent">✅ Sent</option>
            <option value="Failed">❌ Failed</option>
            <option value="Not Sent">➖ Not Sent</option>
          </select>
        </div>
      </div>

      {/* Retry Failed */}
      {failedFilteredLogs.length > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <button
            onClick={() => onResendFilteredFailed(failedFilteredLogs.map(l => l.log_id))}
            style={{ padding: '10px 20px', backgroundColor: '#e65100', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🔁 Retry {failedFilteredLogs.length} Failed WhatsApp Messages
          </button>
        </div>
      )}

      {/* Bulk Resend by Date */}
      <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '10px', border: '1px solid #eee', display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>📅 දිනය අනුව Bulk Resend</label>
          <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
        </div>
        <button
          onClick={() => onBulkResend(bulkDate)}
          style={{ padding: '10px 20px', backgroundColor: '#25d366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          💬 Bulk Resend
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f4ff', textAlign: 'left' }}>
              <th style={{ padding: '12px', fontSize: '13px' }}>මව්පිය නම</th>
              <th style={{ padding: '12px', fontSize: '13px' }}>දුරකථනය</th>
              <th style={{ padding: '12px', fontSize: '13px' }}>වර්ගය</th>
              <th style={{ padding: '12px', fontSize: '13px' }}>💬 WhatsApp</th>
              <th style={{ padding: '12px', fontSize: '13px' }}>දිනය</th>
              <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>ක්‍රියාමාර්ග</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.log_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px', fontWeight: '500' }}>{log.parent_name || 'N/A'}</td>
                <td style={{ padding: '12px', fontSize: '13px', color: '#555' }}>{log.parent_phone}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', backgroundColor: '#e8eaf6', borderRadius: '4px', fontSize: '11px', color: '#1a237e', fontWeight: 'bold' }}>
                    {log.sms_type}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {waStatusStyle(log.whatsapp_status || log.status)}
                </td>
                <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                  {new Date(log.sent_at).toLocaleString('si-LK')}
                </td>
                <td style={{ padding: '12px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setSelectedMessage(log)}
                    style={{ padding: '5px 10px', backgroundColor: '#455a64', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    👁️ View
                  </button>
                  <button
                    onClick={() => onResend(log.log_id)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: (log.whatsapp_status === 'Failed' || log.status === 'Failed') ? '#f57c00' : '#25d366',
                      color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px'
                    }}
                  >
                    {(log.whatsapp_status === 'Failed' || log.status === 'Failed') ? '🔁 Retry' : '🔄 Resend'}
                  </button>
                  <button
                    onClick={() => onDelete(log.log_id)}
                    style={{ padding: '5px 10px', backgroundColor: '#ef5350', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                  💬 WhatsApp වාර්තා හමුවුනේ නැත.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {selectedMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#1a237e' }}>💬 WhatsApp Message Preview</h3>
              <button onClick={() => setSelectedMessage(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <small style={{ color: '#888', fontWeight: 'bold' }}>👤 මව්පිය:</small>
              <div style={{ fontSize: '15px', fontWeight: '500' }}>{selectedMessage.parent_name || 'N/A'}</div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <small style={{ color: '#888', fontWeight: 'bold' }}>📞 දුරකථනය:</small>
              <div style={{ fontSize: '15px' }}>{selectedMessage.parent_phone}</div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <small style={{ color: '#888', fontWeight: 'bold' }}>💬 WhatsApp Status:</small>
              <div style={{ marginTop: '4px' }}>{waStatusStyle(selectedMessage.whatsapp_status || selectedMessage.status)}</div>
            </div>

            {/* WhatsApp Chat Bubble Style */}
            <div style={{ marginTop: '15px' }}>
              <small style={{ color: '#888', fontWeight: 'bold' }}>📨 පණිවිඩය:</small>
              <div style={{
                marginTop: '8px', padding: '15px 18px', backgroundColor: '#dcf8c6',
                borderRadius: '0 12px 12px 12px', lineHeight: '1.6',
                whiteSpace: 'pre-wrap', fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #25d366'
              }}>
                {selectedMessage.message_body}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setSelectedMessage(null)} style={{ flex: 1, padding: '12px', border: '1px solid #ccc', background: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Close
              </button>
              <button
                onClick={() => { onResend(selectedMessage.log_id); setSelectedMessage(null); }}
                style={{ flex: 1, padding: '12px', backgroundColor: '#25d366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                💬 Resend WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QR Code Modal */}
      {qrModalVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#1a237e', marginTop: 0 }}>📲 Scan WhatsApp QR</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>ඔබගේ ජංගම දුරකථනයේ WhatsApp විවෘත කර <strong>Linked Devices</strong> මගින් මෙය Scan කරන්න.</p>
            {qrCodeImg ? (
              <img src={qrCodeImg} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px', margin: '20px auto', display: 'block' }} />
            ) : (
              <div style={{ padding: '40px', color: '#666', fontSize: '14px' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                {qrStatusText || 'QR කේතය ලබා ගනිමින්...'}
              </div>
            )}
            <button
              onClick={handleReconnect}
              disabled={reconnecting}
              style={{ padding: '8px 16px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '8px', cursor: reconnecting ? 'wait' : 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '8px' }}
            >
              {reconnecting ? '...' : '🔄 නැවත සම්බන්ධ කර QR අලුත් කරන්න'}
            </button>
            <button onClick={() => setShowQrModal(false)} style={{ padding: '10px 20px', backgroundColor: '#455a64', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

SMSLogTab.propTypes = {
  logs: PropTypes.array.isRequired,
  onResend: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onBulkResend: PropTypes.func.isRequired,
  onResendFilteredFailed: PropTypes.func.isRequired,
  whatsappStatus: PropTypes.object
};

export default SMSLogTab;