// Defence-in-depth against HTML/script injection: every string in req.body / req.query
// has HTML tags, stray angle brackets and control characters removed BEFORE any controller
// sees it. Controllers still run their own field-level `sanitizeText`/format checks; this
// layer just guarantees nothing tag-shaped can slip through a field somebody forgot.
//
// Deliberately NOT applied to: passwords / tokens / OTPs (must round-trip byte-for-byte),
// base64 image payloads (huge, never rendered as HTML), and anything that isn't a string.

const SKIP_KEYS = new Set([
  'password', 'newPassword', 'confirmPassword', 'currentPassword', 'password_hash',
  'otp', 'qr_token', 'token', 'image_data', 'face_encoding', 'hash', 'md5sig',
]);

const stripHtml = (value) => value
  .replace(/<[^>]*>/g, '')                 // <b>, <script ...>, <img onerror=...>
  .replace(/[<>]/g, '')                    // any bracket left over (unbalanced tags)
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // control chars (keeps \t \n \r)

const cleanValue = (value, key, depth = 0) => {
  if (depth > 6) return value;
  if (typeof value === 'string') return SKIP_KEYS.has(key) ? value : stripHtml(value);
  if (Array.isArray(value)) return value.map((v) => cleanValue(v, key, depth + 1));
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = cleanValue(value[k], k, depth + 1);
    return value;
  }
  return value;
};

module.exports = function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') cleanValue(req.body, null);
  if (req.query && typeof req.query === 'object') cleanValue(req.query, null);
  next();
};

module.exports.stripHtml = stripHtml;
