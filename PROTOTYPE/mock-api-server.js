const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = 5000;
server.listen(PORT, 'localhost', () => {
  console.log(`✅ Mock API Server listening on http://localhost:${PORT}`);
});
