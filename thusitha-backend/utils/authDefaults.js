const bcrypt = require('bcryptjs');

// Role-based starting passwords. A freshly created / admin-reset account gets the value
// for its role; login flags `must_change_password` while the hash still matches, and the
// Forgot-Password (WhatsApp OTP) flow lets the user set their own.
const DEFAULT_PASSWORDS = {
  Admin: 'Admin@123',
  'Counter Person': 'Counter@123',
  Teacher: 'Teacher@123',
  Student: 'Student@123',
  Parent: 'Parent@123',
};
const FALLBACK_PASSWORD = 'Welcome@123';

const defaultPasswordFor = (role) => DEFAULT_PASSWORDS[role] || FALLBACK_PASSWORD;

const hashDefaultPassword = async (role) => bcrypt.hash(defaultPasswordFor(role), 10);

// True when the stored hash is still the role's default (i.e. never personalised).
const isUsingDefaultPassword = async (role, passwordHash) => {
  try {
    return await bcrypt.compare(defaultPasswordFor(role), passwordHash);
  } catch {
    return false;
  }
};

module.exports = { DEFAULT_PASSWORDS, defaultPasswordFor, hashDefaultPassword, isUsingDefaultPassword };
