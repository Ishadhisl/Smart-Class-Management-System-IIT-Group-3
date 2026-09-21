import PropTypes from 'prop-types';
import { CheckCircle, Circle } from 'lucide-react';
import { passwordChecks } from '../../utils/formValidation';

/**
 * Live "how your password must look" checklist. Each rule flips to a green tick as the
 * user types, so they never have to guess why a password was rejected.
 */
const PasswordRules = ({ value, className = '' }) => (
  <div className={`mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs ${className}`}>
    <p className="font-semibold text-slate-600 mb-1">මුරපදය මෙසේ විය යුතුයි (උදා: <span className="font-mono">Nimal@2026</span>):</p>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
      {passwordChecks(value).map((r) => (
        <li key={r.key} className={r.ok ? 'text-green-700' : 'text-slate-500'}>
          <span className="inline-flex w-4">{r.ok ? <CheckCircle size={13} /> : <Circle size={13} />}</span> {r.label}
        </li>
      ))}
    </ul>
  </div>
);

PasswordRules.propTypes = {
  value: PropTypes.string,
  className: PropTypes.string,
};

export default PasswordRules;
