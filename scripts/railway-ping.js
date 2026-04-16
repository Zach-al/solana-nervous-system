const http = require('http');

console.log("Pinging Railway...");
const req = http.request({
  hostname: 'solnet-production.up.railway.app',
  path: '/health',
  method: 'GET',
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => console.log(`DATA: ${data}`));
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.end();
