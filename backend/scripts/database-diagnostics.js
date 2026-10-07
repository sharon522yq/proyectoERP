// Return only diagnostic codes; never return driver messages, hosts or credentials.
function databaseFailureCode(error) {
  const queue = [error], visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (current.code === 18 || current.codeName === 'AuthenticationFailed') return 'DATABASE_AUTH_FAILED';
    if (current.code === 13 || current.codeName === 'Unauthorized') return 'DATABASE_PERMISSION_DENIED';
    if (['ENOTFOUND', 'ENODATA'].includes(current.code)) return 'DATABASE_DNS_NOT_FOUND';
    if (['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].includes(current.code)) return 'DATABASE_NETWORK_UNREACHABLE';
    if (['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(current.code)) return 'DATABASE_TLS_FAILED';
    queue.push(current.cause, current.reason);
    if (current.servers instanceof Map) for (const server of current.servers.values()) queue.push(server.error);
  }
  return 'DATABASE_AUDIT_FAILED';
}
module.exports = { databaseFailureCode };
