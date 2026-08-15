import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Locally-trusted dev certificate (mkcert), covering localhost/127.0.0.1/LAN IP - needed so
// navigator.mediaDevices (webcam access) is available: browsers only expose it in a "secure
// context" (HTTPS, or plain http://localhost), and this dev server is also reached over the
// LAN IP by phones for QR scanning, which was silently falling back to an insecure context.
const httpsConfig = {
  key: fs.readFileSync(path.resolve(__dirname, '..', 'certs', 'dev-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, '..', 'certs', 'dev-cert.pem')),
};

// https://vite.dev/config/
// Hides Moodle's own dashboard chrome when it's embedded in the SCMS admin UI, since the
// surrounding app already provides branding/navigation. Deliberately leaves the course index
// and the "Edit mode" switch alone - that toggle is how materials actually get uploaded.
const MOODLE_EMBED_STYLE = `<style>
  .secondary-navigation, .navbar-brand, .popover-region-toggle, .popover-region-notifications, #page-footer {
    display: none !important;
  }
</style></head>`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,   // Expose on 0.0.0.0 so phone on same Wi-Fi can connect
    port: 5173,
    https: httpsConfig,
    proxy: {
      // Serve Moodle same-origin so its session cookie isn't dropped as a
      // cross-origin iframe cookie by the browser (SSO login was silently
      // failing back to Moodle's login form otherwise).
      '/moodle': {
        target: 'http://localhost',
        changeOrigin: true,
        // Moodle bakes its own absolute address (http://localhost/moodle, port 80) into
        // redirects, page HTML, and inline JS config (M.cfg.wwwroot) that its own client-side
        // code then uses for every AJAX call (file uploads, edit-mode actions, etc). Left
        // alone, the browser would follow/call those straight out of the proxy back to port
        // 80 - a genuine cross-origin request - which breaks the session and Moodle's JS
        // (surfacing as a blank "undefined" error dialog). Rewrite both redirects and
        // response bodies so every reference stays on whatever host:port the browser is
        // actually using to reach Vite.
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Ask Apache not to compress, so the body we get back is plain text we can rewrite.
            proxyReq.setHeader('Accept-Encoding', 'identity');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Chrome negotiates HTTP/2 with this dev server now that it's HTTPS. HTTP/2 has no
            // Host header - the equivalent info arrives as the ':authority' pseudo-header - so
            // req.headers.host is silently undefined for h2 requests (curl/HTTP-1.1 clients were
            // fine, which is why this only showed up in real browsers, not curl-based checks).
            const host = req.headers.host || req.headers[':authority'];
            const location = proxyRes.headers['location'];
            if (location && location.startsWith('http://localhost/')) {
              // Vite itself is served over https (see httpsConfig above) - rewritten links must
              // match that scheme or the browser blocks them as mixed content. The proxy's own
              // hop to Moodle stays plain http (target above); only what the browser sees changes.
              proxyRes.headers['location'] = location.replace('http://localhost', `https://${host}`);
            }

            const contentType = proxyRes.headers['content-type'] || '';
            if (!/html|javascript|json|css/.test(contentType)) {
              delete proxyRes.headers['content-length'];
              res.writeHead(proxyRes.statusCode, proxyRes.headers);
              proxyRes.pipe(res);
              return;
            }

            const chunks = [];
            proxyRes.on('data', (chunk) => chunks.push(chunk));
            proxyRes.on('end', () => {
              let body = Buffer.concat(chunks).toString('utf8');
              body = body.split('http://localhost/moodle').join(`https://${host}/moodle`);
              body = body.split('http:\\/\\/localhost\\/moodle').join(`https:\\/\\/${host}\\/moodle`);
              if (contentType.includes('html')) {
                body = body.replace('</head>', MOODLE_EMBED_STYLE);
              }
              const bodyBuffer = Buffer.from(body, 'utf8');
              delete proxyRes.headers['transfer-encoding'];
              proxyRes.headers['content-length'] = bodyBuffer.length;
              res.writeHead(proxyRes.statusCode, proxyRes.headers);
              res.end(bodyBuffer);
            });
          });
        },
      },
    },
  }
})
