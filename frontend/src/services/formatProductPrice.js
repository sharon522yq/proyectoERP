// Existing records may contain legacy currency labels; they must not crash the catalog.
export function formatProductPrice(price, currency) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return '—';
  const code = String(currency || 'MXN').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: code }).format(amount) + ' ' + code;
    } catch { /* Fall back when the platform cannot format this currency. */ }
  }
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + (code ? ' ' + code : '');
}
