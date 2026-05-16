const { app, BrowserWindow, session, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Minimal MIME map — enough for what this app loads.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz':   'application/gzip',
  '.traineddata': 'application/octet-stream'
};
function mimeFor (p) {
  return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
}

// Register a custom "app://" scheme as standard + secure + fetch-capable.
// Must happen BEFORE app.whenReady().
//
// Why: tesseract.js v5 loads its wasm core with importScripts (works on
// file://) but then uses fetch() for the .wasm binary and language data.
// fetch() against file:// from a Web Worker is blocked by Chromium.
// Serving the same files via a privileged custom protocol gives the
// renderer a normal HTTP-like origin where fetch() Just Works.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
]);

async function createWindow () {
  // Wipe any leftover SW state from previous runs so it can't intercept.
  try {
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage', 'shadercache']
    });
  } catch (err) {
    console.warn('Failed to clear SW storage:', err);
  }

  // Resolve "app://app/<pathname>" to a file inside the project directory.
  // Reads from disk directly with fs so missing files cleanly become 404s
  // (rather than throwing a generic "Failed to fetch"), and so we can log
  // exactly which path was requested when something is missing.
  protocol.handle('app', async (req) => {
    const reqUrl = new URL(req.url);
    let pathname = decodeURIComponent(reqUrl.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    // Prevent path traversal.
    const resolved = path.normalize(path.join(__dirname, pathname));
    if (!resolved.startsWith(__dirname)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fs.promises.readFile(resolved);
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': mimeFor(resolved) }
      });
    } catch (err) {
      console.warn('[app://] 404', req.url, '->', resolved, err.code || err.message);
      return new Response('Not Found: ' + pathname, {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  });

  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true
    }
  });

  // Load via the custom scheme instead of loadFile().
  win.loadURL('app://app/index.html');
}

app.whenReady().then(createWindow);
