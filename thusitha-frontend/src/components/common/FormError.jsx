import PropTypes from 'prop-types';
import { FaExclamationCircle } from 'react-icons/fa';

const FormError = ({ children, className = '' }) => {
  if (!children) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium text-danger mt-1.5 ${className}`}>
      <FaExclamationCircle size={13} className="shrink-0" />
      {children}
    </p>
  );
};

FormError.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

export default FormError;
