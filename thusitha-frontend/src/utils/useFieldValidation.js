import { useState, useCallback } from 'react';
import { filterWithFeedback, runValidators } from './formValidation';

/**
 * Field-level validation wired onto a form's existing `data`/`setData` state.
 *
 *   const rules = (d) => ({ name: () => validateName(d.name), phone: () => validatePhone(d.phone) });
 *   const v = useFieldValidation(formData, setFormData, rules);
 *   <input value={formData.name}
 *          onChange={(e) => v.set('name', e.target.value, filterNameInput, NAME_INVALID_MSG)}
 *          onBlur={() => v.blur('name')} />
 *   <FormError>{v.errors.name}</FormError>
 *   onSubmit: if (!v.validateAll()) return;
 *
 * - `set` applies an optional as-you-type filter and shows `blockedMsg` the instant a
 *   disallowed character is typed; a field that already has an error is re-validated on
 *   every keystroke so the message disappears as soon as it's fixed. Pass `{ live: true }`
 *   (5th arg) to validate on every keystroke from the start - used for email boxes.
 * - `blur` validates just that field. `validateAll` validates everything, focuses the
 *   first invalid element (by id = field name, or `ids[field]`) and returns true/false.
 */
export function useFieldValidation(data, setData, rulesFn, ids = {}) {
  const [errors, setErrors] = useState({});

  const set = useCallback((field, rawValue, filterFn, blockedMsg, { live = false } = {}) => {
    let value = rawValue;
    let blocked = false;
    if (filterFn) {
      const r = filterWithFeedback(rawValue, filterFn);
      value = r.filtered;
      blocked = r.invalidAttempt;
    }
    const next = { ...data, [field]: value };
    setData(next);
    setErrors((prev) => {
      const rule = rulesFn(next)[field];
      // live: validate on every keystroke (email boxes) - otherwise only once an error is showing
      const msg = blocked ? blockedMsg : (live || prev[field]) && rule ? rule() : '';
      return { ...prev, [field]: msg || '' };
    });
  }, [data, setData, rulesFn]);

  const blur = useCallback((field) => {
    const rule = rulesFn(data)[field];
    if (!rule) return;
    setErrors((prev) => ({ ...prev, [field]: rule() || '' }));
  }, [data, rulesFn]);

  const validateAll = useCallback(() => {
    const result = runValidators(rulesFn(data), ids);
    setErrors(result.errors);
    return result.valid;
  }, [data, rulesFn, ids]);

  const clear = useCallback(() => setErrors({}), []);

  return { errors, set, blur, validateAll, clear, invalid: (f) => !!errors[f] };
}

export default useFieldValidation;
