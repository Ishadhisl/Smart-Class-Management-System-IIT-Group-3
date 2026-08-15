import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

/**
 * Shared frosted-glass card used across the app.
 * Matches the pattern already proven in HomeTab.jsx.
 */
const Card = ({ children, className = '', hover = false, padding = 'p-6', as: Component = motion.div, ...rest }) => {
  return (
    <Component
      className={`bg-white/80 backdrop-blur-xl ${padding} rounded-2xl shadow-glass border border-white/60 transition-shadow duration-300 ${hover ? 'hover:shadow-glass-hover' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
};

Card.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  hover: PropTypes.bool,
  padding: PropTypes.string,
  as: PropTypes.elementType,
};

export default Card;
