const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello Node\n');
}).listen(8080, '0.0.0.0');
console.log('Listening 0.0.0.0:8080');
