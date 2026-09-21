# SCMS — Security Measures

How the Smart Class Management System defends against the common web attack classes, where
each defence lives in the code, and how it is proven by the automated test suite
(`thusitha-backend/tests/system/security.test.js`, run with `npm test`).

## 1. SQL injection
- Every database access goes through `pg` **parameterised queries** (`db.pool.query(sql, [params])`);
  user input is never concatenated into SQL text. The two dynamic fragments that exist
  (`reportController` date filter, `paymentController` teacher join) only splice in `$n`
  placeholders.
- Format validation before the DB is reached: phone (`isValidPhone`), email (`isValidEmail`),
  person names (`isValidName` — letters/spaces only), numeric ids.
- **Test:** classic payloads (`' OR '1'='1`, `'; DROP TABLE Users; --`, `pg_sleep`) sent to
  login / public registration — the payload never appears in any SQL string and travels only
  as a bound parameter.

## 2. HTML injection / stored & reflected XSS
- `middleware/sanitizeBody.js` runs on **every request**: strips `<tags>`, stray `<`/`>` and
  control characters from all string fields in `req.body`/`req.query` (passwords, tokens and
  base64 image payloads are exempt so they round-trip intact).
- Controllers additionally call `sanitizeText()` (+ length caps) on every free-text field, and
  `isValidName()` **rejects** names containing digits/symbols/HTML outright.
- Frontend: React escapes all rendered text; there is no `dangerouslySetInnerHTML` in the
  codebase. Inputs block `<` `>` as you type (`filterTextInput`) and show "වලංගු නොවන ආදානයකි".
- Uploaded files are served with `X-Content-Type-Options: nosniff` and a restrictive
  `Content-Security-Policy` (`default-src 'none'; sandbox`), so a file can never execute as a page.
- **Test:** `<script>`, `<img onerror>`, `<svg/onload>`, `<iframe javascript:>` payloads —
  stripped by `sanitizeText`, refused by `isValidName`, stored inert by the contact endpoint.

## 3. Authentication & passwords
- JWT (24h) in `sessionStorage`; API middleware `verifyToken` + role gate `checkRole`.
- Login lockout: 3 wrong passwords → 5-minute lock (`Users.failed_login_attempts/locked_until`).
- Password policy enforced server-side (`passwordPolicyError`) and mirrored client-side with a
  live checklist: 8+ chars, upper, lower, digit, symbol, no spaces, not the role default.
- Role default passwords (`Student@123` …) are flagged `must_change_password` at login.
- WhatsApp OTP for password reset (6 digits, 10-minute expiry, single use).
- **Rate limiting** (`express-rate-limit`): login 30/15 min, OTP endpoints 10/15 min, public
  registration & contact form 20/hour per IP. Body size capped (JSON 5 MB).

## 4. Authorisation / IDOR
- Students and parents can only read their own payments, receipts and PayHere order status
  (`resolveOwnStudentId`, `isOwnChild`); staff routes are role-gated.
- PayHere notify callback is verified with the merchant-secret MD5 signature.

## 5. File uploads
- `multer` with **extension + MIME allow-lists** (images / PDF / Office / video), 10 MB cap,
  server-generated file names (never the client's), stored outside the web root except the
  `/uploads` static mount described above.

## 6. Transport & headers
- `helmet` security headers; CORS allow-list (frontend origins + private LAN IPs for QR scanning).
- Dev runs over HTTPS with a locally-trusted cert (webcam API requires a secure context);
  production terminates TLS at Render/Vercel.
