// Shared client-side form validation: real-time character filtering (block invalid
// keystrokes as the user types) plus on-blur/on-submit format checks with a plain
// error-message string per field, meant to be shown via <FormError> under each
// <Input invalid={...}>. Mirrors the equivalent checks the backend re-runs
// (thusitha-backend/utils/validators.js) - this is UX, not the security boundary.

// Letters (Latin + Sinhala) + spaces + a few punctuation marks real names use
// (apostrophe, hyphen, period for "Mr.", "D'Silva", "Anne-Marie"). ‍/‌ are the
// zero-width joiner/non-joiner Sinhala needs for conjuncts (e.g. "ශ්‍රී") - stripping them
// silently mangles Sinhala names as they're typed.
const NAME_CHAR_RE = /^[A-Za-z඀-෿\u200C\u200D\s.'-]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sri Lankan mobile: 07XXXXXXXX or +947XXXXXXXX
const SL_PHONE_RE = /^(?:\+94|0)7\d{8}$/;
// Subject: must contain at least one letter (Latin or Sinhala); digits and the
// punctuation real subject names use ("O/L Science", "A/L Chemistry", "Grade 5
// Scholarship", "ගණිතය (Mathematics)", "ICT - Theory") are allowed. Purely numeric or
// symbol-only names are rejected.
const SUBJECT_RE = /^(?=.*[A-Za-z඀-෿])[A-Za-z0-9඀-෿\u200C\u200D\s.,'()&/-]+$/;
// --- As-you-type filters: strip characters that could never be valid for the field,
// so the user simply can't type "hththtjjjjtjutjuut" into a phone box in the first place.
export const filterNameInput = (value) => value.replace(/[^A-Za-z඀-෿\u200C\u200D\s.'-]/g, '');
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

// Password policy (mirrors passwordPolicyError in thusitha-backend/utils/validators.js):
// 8+ characters, an uppercase letter, a lowercase letter, a digit and a symbol, no spaces.
export const PASSWORD_SYMBOLS = '@ $ ! % * # ? & . - _';
export const PASSWORD_RULES = [
  { key: 'length', label: 'අවම වශයෙන් අකුරු 8ක්', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'Capital අකුරක් (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'Simple අකුරක් (a-z)', test: (v) => /[a-z]/.test(v) },
  { key: 'digit', label: 'ඉලක්කමක් (0-9)', test: (v) => /\d/.test(v) },
  { key: 'symbol', label: 'සංකේතයක් (@ $ ! % * # ? & . - _)', test: (v) => /[@$!%*#?&.\-_]/.test(v) },
  { key: 'space', label: 'හිස්තැන් (space) නැත', test: (v) => !/\s/.test(v) },
];
// Per-rule pass/fail for a live checklist under the password box.
export const passwordChecks = (value) => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(value || '') }));

export function validatePassword(value, { required = true } = {}) {
  const v = (value || '');
  if (!v) return required ? 'මුරපදය අනිවාර්ය වේ.' : '';
  const failed = passwordChecks(v).find((r) => !r.ok);
  return failed ? `මුරපදය: ${failed.label} අවශ්‍යයි.` : '';
}

export function validateSubject(value, { required = true, label = 'විෂය' } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? `${label} අනිවාර්ය වේ.` : '';
  if (!SUBJECT_RE.test(v)) return `${label} තුළ අවම වශයෙන් අකුරක් තිබිය යුතුයි (අංක/සංකේත පමණක් යෙදිය නොහැක).`;
  return '';
}

// --- Free-text fields (school, address, description, subject line, bio ...): anything
// goes EXCEPT angle brackets, so "<script>", "<img onerror=...>" or even a harmless
// "<b>" can never be typed. The backend strips tags again (utils/validators.js);
// this just gives the user an instant "වලංගු නොවන ආදානයකි" instead of a silent server-side edit.
export const filterTextInput = (value) => value.replace(/[<>]/g, '');
export const TEXT_INVALID_MSG = 'වලංගු නොවන ආදානයකි: < > සහ HTML tags යෙදිය නොහැක.';
const HTML_TAG_RE = /<[^>]*>|[<>]/;

export function validateText(value, { required = false, label = 'මෙම ක්ෂේත්‍රය', min = 0, max = 500 } = {}) {
  const v = (value || '').toString().trim();
  if (!v) return required ? `${label} අනිවාර්ය වේ.` : '';
  if (HTML_TAG_RE.test(v)) return `${label} තුළ HTML tags / < > යෙදිය නොහැක.`;
  if (min && v.length < min) return `${label} අවම වශයෙන් අකුරු ${min}ක් විය යුතුයි.`;
  if (max && v.length > max) return `${label} අකුරු ${max}කට වඩා දිග විය නොහැක.`;
  return '';
}

// Numeric fields (fee, capacity, marks, rank). `integer` rejects decimals.
export function validateNumber(value, { required = true, label = 'අගය', min = null, max = null, integer = false } = {}) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return required ? `${label} අනිවාර්ය වේ.` : '';
  const n = Number(raw);
  if (Number.isNaN(n)) return `${label} සඳහා ඉලක්කම් පමණක් ඇතුළත් කරන්න.`;
  if (integer && !Number.isInteger(n)) return `${label} පූර්ණ සංඛ්‍යාවක් විය යුතුයි.`;
  if (min !== null && n < min) return `${label} ${min} ට වඩා අඩු විය නොහැක.`;
  if (max !== null && n > max) return `${label} ${max} ට වඩා වැඩි විය නොහැක.`;
  return '';
}

export function validateYear(value, { required = false, label = 'වර්ෂය' } = {}) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return required ? `${label} අනිවාර්ය වේ.` : '';
  if (!/^\d{4}$/.test(raw)) return `${label} ඉලක්කම් 4කින් යුත් වර්ෂයක් විය යුතුයි (උදා: 2026).`;
  const y = Number(raw);
  const thisYear = new Date().getFullYear();
  if (y < 1990 || y > thisYear + 1) return `${label} 1990 සහ ${thisYear + 1} අතර විය යුතුයි.`;
  return '';
}

export function validateDate(value, { required = true, label = 'දිනය' } = {}) {
  const raw = (value || '').toString().trim();
  if (!raw) return required ? `${label} අනිවාර්ය වේ.` : '';
  if (Number.isNaN(new Date(raw).getTime())) return `වලංගු ${label}ක් තෝරන්න.`;
  return '';
}

// Helper for a submit handler: runs every validator in `spec` ({ field: () => msg }),
// returns { errors, valid } and focuses the first invalid element (looked up by the
// element id in `ids`, or the field name itself) so the user lands on what to fix.
export function runValidators(spec, ids = {}) {
  const errors = {};
  for (const [field, fn] of Object.entries(spec)) errors[field] = fn() || '';
  const firstBad = Object.keys(errors).find((k) => errors[k]);
  if (firstBad && typeof document !== 'undefined') {
    const el = document.getElementById(ids[firstBad] || firstBad);
    if (el && typeof el.focus === 'function') el.focus();
  }
  return { errors, valid: !firstBad };
}

// --- Non-negative numeric inputs (fees, capacities, marks, amounts). <input type="number">
// still lets the user type "-", "+" and "e"; block those keystrokes outright and strip them
// from pasted text so a negative or exponent value can never even appear in the box.
export const NUMBER_BLOCKED_KEYS = ['-', '+', 'e', 'E'];
export const blockNegativeKeys = (e) => {
  if (NUMBER_BLOCKED_KEYS.includes(e.key)) e.preventDefault();
};
export const filterNonNegativeNumber = (value) => value.toString().replace(/[^0-9.]/g, '');
export const NUMBER_INVALID_MSG = 'වලංගු නොවන ආදානයකි: ධන ඉලක්කම් පමණක් යොදන්න (සෘණ අගයන් ඉඩ නොදේ).';
