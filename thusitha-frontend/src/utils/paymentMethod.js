/**
 * Human labels for Payments.payment_method.
 *
 * The column holds whatever the code path that inserted the row wrote
 * ("Cash", "Bank Transfer", "PayHere", "PayHere (VISA)", old test values like
 * "Card (Dummy)"). The screens should show one consistent set of labels.
 */
const LABELS = {
  cash: { si: 'මුදල් (Cash)', en: 'Cash' },
  bank: { si: 'බැංකු තැන්පතුව (Bank Transfer)', en: 'Bank Transfer' },
  payhere: { si: 'Online (PayHere)', en: 'Online (PayHere)' },
  card: { si: 'Online (Card)', en: 'Online (Card)' },
};

const keyOf = (raw) => {
  const m = String(raw || '').trim().toLowerCase();
  if (!m || m === 'cash') return 'cash';
  if (m.includes('bank')) return 'bank';
  if (m.includes('payhere')) return 'payhere';
  if (m.includes('card') || m.includes('stripe') || m.includes('online')) return 'card';
  return null;
};

/** Sinhala + English label for the dashboard tables. */
export const paymentMethodLabel = (raw) => {
  const k = keyOf(raw);
  return k ? LABELS[k].si : String(raw || '-');
};

/** ASCII-only label for the jsPDF receipt (Helvetica has no Sinhala glyphs). */
export const paymentMethodLabelEn = (raw) => {
  const k = keyOf(raw);
  return k ? LABELS[k].en : String(raw || 'Cash');
};
