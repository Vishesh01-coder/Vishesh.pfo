const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

// In-memory RAM cache for instant 0.1ms responses on localhost
const fileCache = new Map();

function preloadCache() {
  console.log('Pre-caching image frames into RAM for instantaneous delivery...');
  let totalBytes = 0;
  for (let i = 1; i <= 300; i++) {
    const filename = `ezgif-frame-${String(i).padStart(3, '0')}.jpg`;
    const fullPath = path.join(BASE_DIR, filename);
    if (fs.existsSync(fullPath)) {
      const buf = fs.readFileSync(fullPath);
      fileCache.set('/' + filename, buf);
      totalBytes += buf.length;
    }
  }
  console.log(`Pre-cached 300 frames (${(totalBytes / 1024 / 1024).toFixed(2)} MB) in RAM.`);
}

preloadCache();

const server = http.createServer((req, res) => {
  // CORS & performance headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Connection', 'keep-alive');

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Check in-memory RAM cache for images first
  if (fileCache.has(reqPath)) {
    const buf = fileCache.get(reqPath);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
    return;
  }

  const filePath = path.normalize(path.join(BASE_DIR, reqPath));

  // Security check
  if (!filePath.startsWith(BASE_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('File not found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // HTML / CSS / JS are read fresh so updates are immediate
    res.setHeader('Content-Type', contentType);
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    // Force inline display in browser for PDFs and images so they never trigger download dialogs
    if (ext === '.pdf' || ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
    }

    res.setHeader('Content-Length', stats.size);

    console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] 200 ${req.method} ${reqPath} (${contentType})`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`Ultra-Smooth Scroll Server running at: http://localhost:${port}/`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
