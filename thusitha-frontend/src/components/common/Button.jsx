import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { FaSpinner } from 'react-icons/fa';

const MotionA = motion.a;

const VARIANTS = {
  primary: 'bg-gradient-to-r from-primary to-primary-light text-white shadow-glass hover:shadow-glass-hover',
  secondary: 'bg-gradient-to-r from-secondary to-secondary-light text-white shadow-glass hover:shadow-glass-hover',
  danger: 'bg-danger text-white hover:bg-danger-dark shadow-glass hover:shadow-glass-hover',
  success: 'bg-success text-white hover:bg-success-dark shadow-glass hover:shadow-glass-hover',
  whatsapp: 'bg-[#25d366] text-white hover:bg-[#1da851] shadow-glass hover:shadow-glass-hover',
  outline: 'bg-white/60 border border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
};

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-3.5 text-base',
};

/**
 * Shared button. Preserves the same disabled/loading UX every page already
 * implements by hand (text swap + disabled) but as one reusable component.
 */
const Button = ({
  children,
  as = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  fullWidth = false,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || loading;
  const isLink = as === 'a';
  const Component = isLink ? MotionA : motion.button;

  return (
    <Component
      type={isLink ? undefined : type}
      disabled={isLink ? undefined : isDisabled}
      aria-disabled={isDisabled || undefined}
      whileTap={isDisabled ? {} : { scale: 0.96 }}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-bold
        transition-all duration-200
        ${fullWidth ? 'w-full' : ''}
        ${VARIANTS[variant] || VARIANTS.primary}
        ${SIZES[size] || SIZES.md}
        ${isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
        ${className}
      `}
      {...rest}
    >
      {loading ? <FaSpinner size={16} className="animate-spin" /> : icon}
      {children}
    </Component>
  );
};

Button.propTypes = {
  children: PropTypes.node,
  as: PropTypes.oneOf(['button', 'a']),
  variant: PropTypes.oneOf(Object.keys(VARIANTS)),
  size: PropTypes.oneOf(Object.keys(SIZES)),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  icon: PropTypes.node,
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export default Button;
