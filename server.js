/* Zero-dependency static server. `node server.js` then open the URL. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!path.resolve(file).startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const headers = { 'content-type': type, 'cache-control': 'no-store' };

      // GLSL and markup compress about 4:1 — worth ten lines
      const accepts = String(req.headers['accept-encoding'] || '');
      const text = /^(text|application\/(javascript|json)|image\/svg)/.test(type);
      if (text && data.length > 1024 && /\bgzip\b/.test(accepts)) {
        zlib.gzip(data, (e, gz) => {
          if (e) { res.writeHead(200, headers).end(data); return; }
          headers['content-encoding'] = 'gzip';
          headers.vary = 'accept-encoding';
          res.writeHead(200, headers).end(gz);
        });
        return;
      }
      res.writeHead(200, headers).end(data);
    });
  })
  .listen(PORT, () => console.log(`Nowhere Central → http://localhost:${PORT}`));
