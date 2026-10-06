// MongoMemoryServer 9 picks a random port and aborts on EACCES. Windows reserves
// ranges (Hyper-V/WinNAT), so retry that infrastructure error with an OS-selected
// port. Other errors still fail; MongoDB startup and all assertions remain real.
if (process.platform === 'win32') {
  const ports = require('mongodb-memory-server-core/lib/util/getport');
  const net = require('node:net');
  const original = ports.getFreePort;
  ports.getFreePort = async (...args) => {
    try { return await original(...args); }
    catch (error) {
      if (error.code !== 'EACCES') throw error;
      return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          server.close(error => error ? reject(error) : resolve(port));
        });
      });
    }
  };
}
