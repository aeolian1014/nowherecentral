/* Zero-dependency static server. `node server.js` then open the URL.

   It listens on HTTP, and on HTTPS as well when a cert is present in
   certs/ (key.pem + cert.pem). The HTTPS side exists for one reason:
   the device-orientation API — the gyroscope the destination worlds
   tilt to — only fires in a secure context, and a LAN IP over plain
   HTTP is not one. Phones testing over the network need the https URL;
   localhost is already a secure context, so the http side is enough
   there. Generate a cert with:
     openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
       -keyout certs/key.pem -out certs/cert.pem \
       -subj "/CN=Nowhere Central Dev" \
       -addext "subjectAltName=IP:<your-lan-ip>,IP:127.0.0.1,DNS:localhost"
   It is self-signed, so the phone shows a one-time warning to accept. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;
const HTTPS_PORT = process.env.HTTPS_PORT || 4443;
const CERT_DIR = path.join(ROOT, 'certs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.opus': 'audio/ogg; codecs=opus',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function handler(req, res) {
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
}

http.createServer(handler).listen(PORT, () =>
  console.log(`Nowhere Central → http://localhost:${PORT}`));

// HTTPS only if a cert is sitting in certs/. Missing cert is not an
// error: localhost does not need it, and the http server still serves.
try {
  const key = fs.readFileSync(path.join(CERT_DIR, 'key.pem'));
  const cert = fs.readFileSync(path.join(CERT_DIR, 'cert.pem'));
  https.createServer({ key, cert }, handler).listen(HTTPS_PORT, () =>
    console.log(`Nowhere Central → https://localhost:${HTTPS_PORT}  (use this URL on a phone, for the gyroscope)`));
} catch (e) {
  console.log('No certs/ — HTTPS off. Phone gyroscope needs it; see server.js header to generate one.');
}
