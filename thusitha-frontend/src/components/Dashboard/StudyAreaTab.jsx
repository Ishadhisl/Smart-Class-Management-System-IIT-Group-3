import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api'; // Assuming request helper is available
import StudyAreaCountdown from './StudyAreaCountdown';

const StudyAreaTab = ({ students, seats, onBook, onCheckIn, onCheckOut, currentUser }) => {
  const isStudent = !!currentUser;
  // For students, pre-fill student_id from their profile
  const [formData, setFormData] = useState({ 
    student_id: isStudent ? (currentUser._id || currentUser.student_id || '') : '', 
    seat_id: '', 
    expected_arrival_time: '' 
  });

  const getLocalISOString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedTime = new Date(formData.expected_arrival_time);
    const currentTime = new Date();
    if (selectedTime < currentTime) {
      alert("පැමිණෙන වේලාව ලෙස පසුගිය වේලාවක් තෝරා ගත නොහැක. (Expected Arrival time cannot be in the past.)");
      return;
    }
    onBook(formData);
  };

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' };
  
  const getSeatColor = (status) => {
    switch(status) {
      case 'Occupied': return '#f44336';
      case 'Reserved': return '#ff9800';
      default: return '#4caf50';
    }
  };

  // Remove local handleCheckOut as we use onCheckOut prop.

  return (
    <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
      {/* LEFT: Booking Form */}
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', maxWidth: '400px', flex: 1 }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>📖 අසුනක් වෙන් කිරීම</h3>
      <form onSubmit={handleSubmit}>
        {/* Student selector: only show to staff, not to student users */}
        {isStudent ? (
          <div style={{ padding: '10px 12px', backgroundColor: '#e8eaf6', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', color: '#1a237e', fontWeight: 'bold' }}>
            👤 {currentUser.username} — ඔබ වෙනුවෙන් වෙන් කෙරේ
          </div>
        ) : (
          <>
            <label htmlFor="studyStudent" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ශිෂ්‍යයා තෝරන්න</label>
            <select id="studyStudent" style={inputStyle} value={formData.student_id} onChange={(e) => setFormData({...formData, student_id: e.target.value})} required>
              <option value="">-- ශිෂ්‍යයා තෝරන්න --</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.studentId})</option>)}
            </select>
          </>
        )}

        <label htmlFor="studySeat" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>අසුන අංකය</label>
        <input 
          id="studySeat"
          type="text" 
          placeholder="Select from map..." 
          style={inputStyle} 
          value={formData.seat_id ? `අසුන ${seats.find(s=>s.seat_id == formData.seat_id)?.seat_number}` : ''} 
          readOnly 
        />

        <label htmlFor="arrivalTime" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>පැමිණෙන වේලාව (Expected Arrival)</label>
        <input 
          id="arrivalTime"
          type="datetime-local" 
          style={inputStyle} 
          value={formData.expected_arrival_time} 
          onChange={(e) => setFormData({...formData, expected_arrival_time: e.target.value})} 
          required 
          min={getLocalISOString()}
        />

        <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>💡 වෙන් කිරීම් පැය 4කට පමණක් සීමා වේ. විනාඩි 15කට වඩා ප්‍රමාද වුවහොත් වෙන් කිරීම අවලංගු වේ.</p>

        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          💾 අසුන වෙන් කරන්න
        </button>
      </form>
      </div>

      {/* RIGHT: Visual Seat Map */}
      <div style={{ flex: 2, minWidth: '400px', backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ color: '#1a237e', marginBottom: '20px' }}>🪑 අසුන් සැලැස්ම (Live Seat Map)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '15px' }}>
          {/* 💡 Seat status should come from the backend, including current booking_id if occupied/reserved */}
          {seats.map(seat => {
            const isSelected = String(formData.seat_id) === String(seat.seat_id);
            const handleActivate = () => {
              if (seat.status === 'Available') setFormData({ ...formData, seat_id: seat.seat_id });
            };

            const getBorderStyle = () => {
              if (isSelected) return '3px solid #1a237e';
              if (seat.status === 'Available') return 'none';
              return '1px solid #ddd';
            };

            const baseStyle = {
              height: '115px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              backgroundColor: isSelected ? '#ffd600' : getSeatColor(seat.status),
              color: isSelected ? '#1a237e' : 'white',
              cursor: seat.status === 'Available' ? 'pointer' : 'pointer', // Make reserved/occupied pointer as they are clickable buttons too
              fontSize: '14px',
              fontWeight: 'bold',
              border: getBorderStyle(),
              textAlign: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              padding: '8px 5px',
              boxSizing: 'border-box'
            };

            const labelStyle = { fontSize: '10px', opacity: 0.9, marginTop: '3px' };
            const actionLabelStyle = { fontSize: '9px', opacity: 0.9, fontWeight: 'bold', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.3)', width: '90%', paddingTop: '4px' };

            // Render button for available seats, div for others
            if (seat.status === 'Available') {
              return (
              <button
                key={seat.seat_id}
                type="button"
                aria-pressed={isSelected}
                onClick={handleActivate}
                style={baseStyle}
              >
                <span>{seat.seat_number}</span>
                <small style={labelStyle}>{seat.status}</small>
              </button>
              );
            } else if (seat.status === 'Reserved' && seat.current_booking_id) {
              return (
                <button
                  key={seat.seat_id}
                  type="button"
                  onClick={() => onCheckIn(seat.current_booking_id)}
                  style={{ ...baseStyle, backgroundColor: '#ff9800', cursor: 'pointer' }}
                >
                  <span>{seat.seat_number}</span>
                  <small style={labelStyle}>Reserved</small>
                  {seat.expected_arrival_time && (
                    <StudyAreaCountdown 
                      expectedArrivalTime={seat.expected_arrival_time} 
                      bookingId={seat.current_booking_id}
                      onExpire={(id) => {
                        console.log('Booking Expired:', id);
                        // Optional: alert or refresh UI. Since seats state is in parent,
                        // reloading the page is the simplest way to get fresh seats for now,
                        // or we could just alert the user if they're a staff member.
                        window.location.reload();
                      }}
                    />
                  )}
                  <small style={actionLabelStyle}>Check-in</small>
                </button>
              );
            } else if (seat.status === 'Occupied' && seat.current_booking_id) { // Assuming current_booking_id is passed from backend
              return (
                <button
                  key={seat.seat_id}
                  type="button"
                  onClick={() => onCheckOut(seat.current_booking_id, seat.seat_id)}
                  style={{ ...baseStyle, backgroundColor: '#f44336', cursor: 'pointer' }} // Make occupied seats clickable for checkout
                >
                  <span>{seat.seat_number}</span>
                  <small style={labelStyle}>In Use</small>
                  <small style={actionLabelStyle}>Check-out</small>
                </button>
              );
            } else {
              return (
                <div
                  key={seat.seat_id}
                  style={baseStyle}
                >
                  <span>{seat.seat_number}</span>
                  <small style={labelStyle}>{seat.status}</small>
                </div>
              );
            }
          })}
        </div>
        <div style={{ marginTop: '20px', display: 'flex', gap: '15px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#4caf50' }}></div> Available</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#ff9800' }}></div> Reserved</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#f44336' }}></div> In Use</div>
        </div>
      </div>
    </div>
  );
};

StudyAreaTab.propTypes = {
  students: PropTypes.array,
  seats: PropTypes.arrayOf(
    PropTypes.shape({
      seat_id: PropTypes.number.isRequired,
      seat_number: PropTypes.string.isRequired,
      location: PropTypes.string,
      status: PropTypes.string,
      current_booking_id: PropTypes.number,
      expected_arrival_time: PropTypes.string
    })
  ).isRequired,
  onBook: PropTypes.func.isRequired,
  onCheckIn: PropTypes.func.isRequired,
  onCheckOut: PropTypes.func.isRequired,
  currentUser: PropTypes.object, // Pass logged-in user for student role
};

export default StudyAreaTab;