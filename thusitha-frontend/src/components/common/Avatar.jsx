import PropTypes from 'prop-types';
import { useState } from 'react';

const GRADIENTS = [
  'from-primary to-primary-light',
  'from-secondary to-secondary-light',
  'from-accent to-accent-light',
  'from-success to-success-light',
];

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const gradientFor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-20 h-20 text-xl',
  '3xl': 'w-24 h-24 text-3xl',
};

/**
 * Shows the uploaded photo when present and loadable; otherwise falls back
 * to an initials-on-gradient placeholder instead of a broken <img> — covers
 * both a missing path and a path that 404s (e.g. an upload that was never
 * actually placed on disk).
 */
const Avatar = ({ src, name, size = 'md', className = '' }) => {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br ${gradientFor(name)} ${className}`}
      aria-label={name}
    >
      {getInitials(name) || '?'}
    </div>
  );
};

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg', '3xl']),
  className: PropTypes.string,
};

export default Avatar;
