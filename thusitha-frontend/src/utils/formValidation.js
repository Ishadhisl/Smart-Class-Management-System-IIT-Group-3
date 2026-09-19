// Shared client-side form validation: real-time character filtering (block invalid
// keystrokes as the user types) plus on-blur/on-submit format checks with a plain
// error-message string per field, meant to be shown via <FormError> under each
// <Input invalid={...}>. Mirrors the equivalent checks the backend re-runs
// (thusitha-backend/utils/validators.js) - this is UX, not the security boundary.

// Letters (Latin + Sinhala) + spaces + a few punctuation marks real names use
// (apostrophe, hyphen, period for "Mr.", "D'Silva", "Anne-Marie").
const NAME_CHAR_RE = /^[A-Za-z඀-෿\s.'-]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sri Lankan mobile: 07XXXXXXXX or +947XXXXXXXX
const SL_PHONE_RE = /^(?:\+94|0)7\d{8}$/;

// --- As-you-type filters: strip characters that could never be valid for the field,
// so the user simply can't type "hththtjjjjtjutjuut" into a phone box in the first place.
export const filterNameInput = (value) => value.replace(/[^A-Za-z඀-෿\s.'-]/g, '');
export const filterPhoneInput = (value) => value.replace(/[^0-9+]/g, '');

export const NAME_INVALID_MSG = 'වලංගු නොවන ආදානයකි: නම තුළ අකුරු සහ space පමණක් යොදන්න (ඉලක්කම්/සංකේත ඉඩ නොදේ).';
export const PHONE_INVALID_MSG = 'වලංගු නොවන ආදානයකි: දුරකථන අංකයේ ඉලක්කම් සහ + පමණක් යොදන්න (අකුරු ඉඩ නොදේ).';

// Runs a character-filter on a raw keystroke value and reports whether anything was
// actually blocked, so the caller can show an immediate "වලංගු නොවන ආදානයකි" message
// the moment a disallowed character is typed - not just silently drop it.
export function filterWithFeedback(rawValue, filterFn) {
  const filtered = filterFn(rawValue);
  return { filtered, invalidAttempt: filtered !== rawValue };
}

// --- Validators: return an error message string, or '' when the value is valid.
export function validateName(value, { required = true, label = 'නම' } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? `${label} අනිවාර්ය වේ.` : '';
  if (v.length < 2) return `${label} අකුරු 2කට වඩා දිග විය යුතුයි.`;
  if (!NAME_CHAR_RE.test(v)) return `${label} තුළ අකුරු සහ space පමණක් යොදන්න (ඉලක්කම්/සංකේත එපා).`;
  return '';
}

export function validateEmail(value, { required = true } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? 'ඊමේල් ලිපිනය අනිවාර්ය වේ.' : '';
  if (!EMAIL_RE.test(v)) return 'වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න (උදා: name@example.com).';
  return '';
}

export function validatePhone(value, { required = false } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? 'දුරකථන අංකය අනිවාර්ය වේ.' : '';
  if (!SL_PHONE_RE.test(v)) return 'වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න (උදා: 0712345678).';
  return '';
}

export function validateRequired(value, label) {
  return (value || '').toString().trim() ? '' : `${label} අනිවාර්ය වේ.`;
}
