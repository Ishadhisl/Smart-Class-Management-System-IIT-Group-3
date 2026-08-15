import PropTypes from 'prop-types';
import { forwardRef } from 'react';

const Textarea = forwardRef(({ className = '', invalid = false, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={`
      w-full rounded-xl border px-4 py-3 text-sm bg-white/90
      transition focus:outline-none focus:ring-2 resize-y
      ${invalid
        ? 'border-danger focus:ring-danger/40 focus:border-danger'
        : 'border-slate-200 focus:ring-primary/40 focus:border-primary'}
      ${className}
    `}
    {...rest}
  />
));

Textarea.displayName = 'Textarea';

Textarea.propTypes = {
  className: PropTypes.string,
  invalid: PropTypes.bool,
};

export default Textarea;
