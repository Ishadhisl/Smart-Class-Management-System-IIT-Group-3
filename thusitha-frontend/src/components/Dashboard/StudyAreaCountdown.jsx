import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';

const StudyAreaCountdown = ({ expectedArrivalTime, bookingId, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expectedArrivalTime) return;

    const targetTime = new Date(expectedArrivalTime).getTime() + 15 * 60000; // Expected + 15 mins

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        if (bookingId) {
          request(`/study-area/${bookingId}/status`).then((res) => {
             if (res.booking_status === 'Cancelled') {
               if (onExpire) onExpire(bookingId);
             }
          }).catch(console.error);
        } else {
          if (onExpire) onExpire();
        }
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    calculateTimeLeft(); // Initial call
    const intervalId = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(intervalId);
  }, [expectedArrivalTime, onExpire]);

  if (isExpired) {
    return <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>Auto-cancelling...</span>;
  }

  return (
    <span style={{ color: '#ffeb3b', fontWeight: 'bold', fontSize: '10px' }}>
      ⏳ {timeLeft}
    </span>
  );
};

StudyAreaCountdown.propTypes = {
  expectedArrivalTime: PropTypes.string,
  bookingId: PropTypes.number,
  onExpire: PropTypes.func
};

export default StudyAreaCountdown;
