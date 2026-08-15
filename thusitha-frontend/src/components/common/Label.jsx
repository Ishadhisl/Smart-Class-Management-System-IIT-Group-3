import PropTypes from 'prop-types';

const Label = ({ children, className = '', ...rest }) => (
  <label className={`block mb-2 text-sm font-semibold text-slate-700 ${className}`} {...rest}>
    {children}
  </label>
);

Label.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

export default Label;
