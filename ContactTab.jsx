import React, { useState } from 'react';
import PropTypes from 'prop-types';

const ContactTab = ({ messages, onMarkRead, onMarkSpam, onRecoverFromSpam, onBulkDeleteSpam, onMarkAllRead, templates, onToggleImportant, onQuickReply }) => {
  const [filter, setFilter] = useState('Inbox');
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [customReplyMsg, setCustomReplyMsg] = useState('');
  const [showCustomReply, setShowCustomReply] = useState(false);

  const openReply = (msg) => { setSelectedMsg(msg); setShowCustomReply(true); setCustomReplyMsg(''); };
  const sendWhatsAppReply = (msg, text) => {
    if (!msg.sender_phone) { alert('මෙම ශිෂ්‍යයාගේ දුරකථන අංකය නොමැත.'); return; }
    const phone = msg.sender_phone.replace(/\D/g, '').replace(/^0/, '94');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'Inbox') return msg.status !== 'Spam';
    if (filter === 'Spam') return msg.status === 'Spam';
    if (filter === 'Important') return msg.is_important && msg.status !== 'Spam';
    return true; // 'All'
  });

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h3 style={{ color: '#1a237e', margin: '0 0 20px 0' }}>✉️ වෙබ් අඩවිය හරහා ලැබුණු විමසීම්</h3>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setFilter('Inbox')} style={{ padding: '8px 15px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: filter === 'Inbox' ? '#1a237e' : '#eee', color: filter === 'Inbox' ? 'white' : '#333' }}>Inbox ({messages.filter(m => m.status !== 'Spam').length})</button>
        <button onClick={() => setFilter('Important')} style={{ padding: '8px 15px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: filter === 'Important' ? '#ffd600' : '#eee', color: filter === 'Important' ? '#1a237e' : '#333', fontWeight: filter === 'Important' ? 'bold' : 'normal' }}>⭐ Important ({messages.filter(m => m.is_important && m.status !== 'Spam').length})</button>
        <button onClick={() => setFilter('Spam')} style={{ padding: '8px 15px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: filter === 'Spam' ? '#1a237e' : '#eee', color: filter === 'Spam' ? 'white' : '#333' }}>Spam ({messages.filter(m => m.status === 'Spam').length})</button>
        <button onClick={() => setFilter('All')} style={{ padding: '8px 15px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: filter === 'All' ? '#1a237e' : '#eee', color: filter === 'All' ? 'white' : '#333' }}>All ({messages.length})</button>
        
        {filter === 'Inbox' && messages.some(m => m.status !== 'Spam' && !m.is_read) && (
          <button 
            onClick={onMarkAllRead}
            style={{ marginLeft: 'auto', padding: '8px 15px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: '#3f51b5', color: 'white', fontWeight: 'bold' }}
          >✔️ Mark All as Read</button>
        )}

        {filter === 'Spam' && messages.some(m => m.status === 'Spam') && (
          <button 
            onClick={onBulkDeleteSpam}
            style={{ marginLeft: 'auto', padding: '8px 15px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: '#d32f2f', color: 'white', fontWeight: 'bold' }}
          >🗑️ Bulk Delete Spam</button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredMessages.length === 0 && <p>පණිවිඩ කිසිවක් නොමැත.</p>}
        {filteredMessages.map((msg) => (
          <div key={msg.message_id} style={{ 
            padding: '15px', 
            borderRadius: '8px', 
            border: '1px solid #eee', 
            backgroundColor: msg.is_read ? '#fafafa' : '#fff',
            borderLeft: msg.is_read ? '5px solid #ccc' : '5px solid #3f51b5'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={() => onToggleImportant(msg.message_id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: 0, color: msg.is_important ? '#ffd600' : '#ccc' }}
                  title={msg.is_important ? "වැදගත් ලෙස සලකුණු කර ඇත" : "වැදගත් ලෙස සලකුණු කරන්න"}
                >{msg.is_important ? '⭐' : '☆'}</button>
                <strong style={{ fontSize: '16px' }}>{msg.sender_name} ({msg.sender_email})</strong>
              </div>
              <span style={{ fontSize: '12px', color: '#888' }}>{new Date(msg.submitted_at).toLocaleString()}</span>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Subject: </span>{msg.subject || 'No Subject'}
            </div>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.5' }}>{msg.message_text}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {!msg.is_read && (
                <button onClick={() => onMarkRead(msg.message_id)}
                  style={{ padding: '5px 12px', fontSize: '12px', cursor: 'pointer', background: '#3f51b5', color: 'white', border: 'none', borderRadius: '4px' }}
                >Mark as Read</button>
              )}
              {/* WhatsApp Direct Reply */}
              {msg.status !== 'Spam' && (
                <button onClick={() => openReply(msg)}
                  style={{ padding: '5px 12px', fontSize: '12px', cursor: 'pointer', background: '#25d366', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  💬 WhatsApp Reply
                </button>
              )}
              {msg.is_important && msg.status !== 'Spam' && (
                <button onClick={() => { setSelectedMsg(msg); setShowReplyModal(true); }}
                  style={{ padding: '5px 12px', fontSize: '12px', cursor: 'pointer', background: '#ffd600', color: '#1a237e', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
                >⚡ Quick Reply</button>
              )}
              <button onClick={() => msg.status === 'Spam' ? onRecoverFromSpam(msg.message_id) : onMarkSpam(msg.message_id)}
                style={{ padding: '5px 12px', fontSize: '12px', cursor: 'pointer', background: msg.status === 'Spam' ? '#2e7d32' : '#d32f2f', color: 'white', border: 'none', borderRadius: '4px' }}
              >{msg.status === 'Spam' ? 'Recover from Spam' : 'Mark as Spam'}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Custom WhatsApp Reply Modal */}
      {showCustomReply && selectedMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1400 }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '15px', width: '460px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#25d366', display: 'flex', alignItems: 'center', gap: '8px' }}>💬 WhatsApp Reply</h3>
              <button onClick={() => setShowCustomReply(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px' }}>
              To: <strong>{selectedMsg.sender_name}</strong> {selectedMsg.sender_phone ? `(${selectedMsg.sender_phone})` : <span style={{ color: '#d32f2f' }}>— Phone Not Available</span>}
            </p>
            {/* Template Buttons */}
            {templates.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '6px' }}>📋 Templates:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {templates.map((t) => (
                    <button key={t} onClick={() => setCustomReplyMsg(t)} style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #c5cae9', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#f0f4ff', color: '#1a237e' }}>
                      {t.length > 30 ? t.substring(0, 30) + '...' : t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea rows={5} value={customReplyMsg} onChange={e => setCustomReplyMsg(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="WhatsApp message ටයිප් කරන්න..."
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setShowCustomReply(false)} style={{ flex: 1, padding: '11px', border: '1px solid #ddd', background: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { sendWhatsAppReply(selectedMsg, customReplyMsg); setShowCustomReply(false); }}
                disabled={!customReplyMsg.trim() || !selectedMsg.sender_phone}
                style={{ flex: 2, padding: '11px', backgroundColor: selectedMsg.sender_phone && customReplyMsg.trim() ? '#25d366' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >💬 WhatsApp Send</button>
            </div>
            {!selectedMsg.sender_phone && <p style={{ color: '#d32f2f', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>⚠️ දුරකථන අංකය නොමැතිව WhatsApp reply කළ නොහැකිය.</p>}
          </div>
        </div>
      )}

      {/* Quick Reply Modal */}
      {showReplyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1300 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1a237e' }}>⚡ Quick WhatsApp Reply</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>To: <strong>{selectedMsg?.sender_name}</strong> ({selectedMsg?.sender_phone || 'No Phone'})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {templates.map((template) => (
                <button key={template}
                  onClick={() => { onQuickReply(selectedMsg, template); setShowReplyModal(false); }}
                  style={{ textAlign: 'left', padding: '12px', border: '1px solid #eee', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#f9f9f9', fontSize: '13px' }}
                >{template}</button>
              ))}
            </div>
            <button onClick={() => setShowReplyModal(false)} style={{ marginTop: '20px', width: '100%', padding: '10px', background: 'none', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

ContactTab.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      message_id: PropTypes.number.isRequired,
      sender_name: PropTypes.string.isRequired,
      sender_email: PropTypes.string.isRequired,
      submitted_at: PropTypes.string.isRequired,
      subject: PropTypes.string,
      message_text: PropTypes.string.isRequired,
      is_read: PropTypes.bool.isRequired,
      status: PropTypes.string.isRequired, // Added status prop
    })
  ).isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onMarkSpam: PropTypes.func.isRequired,
  onRecoverFromSpam: PropTypes.func.isRequired, // Added recoverFromSpam prop
  onBulkDeleteSpam: PropTypes.func.isRequired,
  onMarkAllRead: PropTypes.func.isRequired,
  templates: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleImportant: PropTypes.func.isRequired,
  onQuickReply: PropTypes.func.isRequired,
};

export default ContactTab;