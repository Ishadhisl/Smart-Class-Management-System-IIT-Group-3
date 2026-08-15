import PropTypes from 'prop-types';
import { forwardRef } from 'react';

/**
 * Shared text input. Purely presentational — behavior (value/onChange/etc.)
 * is passed through unchanged via ...rest, so existing handlers keep working.
 */
const Input = forwardRef(({ className = '', invalid = false, ...rest }, ref) => (
  <input
    ref={ref}
    className={`
      w-full rounded-xl border px-4 py-3 text-sm bg-white/90
      transition focus:outline-none focus:ring-2
      ${invalid
        ? 'border-danger focus:ring-danger/40 focus:border-danger'
        : 'border-slate-200 focus:ring-primary/40 focus:border-primary'}
      ${className}
    `}
    {...rest}
  />
));

Input.displayName = 'Input';

Input.propTypes = {
  className: PropTypes.string,
  invalid: PropTypes.bool,
};

export default Input;
