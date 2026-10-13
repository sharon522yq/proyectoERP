const { databaseFailureCode } = require('../scripts/database-diagnostics');
test.each([
  [{ code: 18 }, 'DATABASE_AUTH_FAILED'],
  [{ code: 13 }, 'DATABASE_PERMISSION_DENIED'],
  [{ cause: { code: 'ENOTFOUND' } }, 'DATABASE_DNS_NOT_FOUND'],
  [{ code: 'ENODATA' }, 'DATABASE_DNS_NOT_FOUND'],
  [{ code: 'ETIMEDOUT' }, 'DATABASE_NETWORK_UNREACHABLE'],
  [{ code: 'CERT_HAS_EXPIRED' }, 'DATABASE_TLS_FAILED'],
  [{ reason: { servers: new Map([['private-host', { error: { code: 'ECONNREFUSED' } }]]) } }, 'DATABASE_NETWORK_UNREACHABLE'],
  [{ message: 'private URI password' }, 'DATABASE_AUDIT_FAILED']
])('returns sanitized database diagnostic %#', (error, expected) => {
  expect(databaseFailureCode(error)).toBe(expected);
});
test('handles cyclic driver errors safely', () => {
  const error = {}; error.cause = error;
  expect(databaseFailureCode(error)).toBe('DATABASE_AUDIT_FAILED');
});
