import PropTypes from 'prop-types';
import { forwardRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';

const Select = forwardRef(({ children, className = '', invalid = false, ...rest }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={`
        w-full appearance-none rounded-xl border px-4 py-3 pr-10 text-sm bg-white/90
        transition focus:outline-none focus:ring-2
        ${invalid
          ? 'border-danger focus:ring-danger/40 focus:border-danger'
          : 'border-slate-200 focus:ring-primary/40 focus:border-primary'}
        ${className}
      `}
      {...rest}
    >
      {children}
    </select>
    <FaChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
  </div>
));

Select.displayName = 'Select';

Select.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  invalid: PropTypes.bool,
};

export default Select;
