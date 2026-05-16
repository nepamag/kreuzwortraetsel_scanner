// Copies the web assets into ./www so Capacitor can package them
// into the Android APK. Run via: npm run android:prepare
//
// We don't want to expose Electron's main.js, node_modules, scripts/,
// or the android/ folder inside the APK — only what the renderer needs.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT  = path.join(ROOT, 'www');

const INCLUDE = [
  'index.html',
  'sw.js',
  'manifest.json',
  'libs'
];

function rmrf (p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyRecursive (src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

console.log('[build-web] cleaning', OUT);
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

for (const name of INCLUDE) {
  const src = path.join(ROOT, name);
  const dst = path.join(OUT, name);
  if (!fs.existsSync(src)) {
    console.warn('[build-web] missing, skipping:', name);
    continue;
  }
  console.log('[build-web] copy', name);
  copyRecursive(src, dst);
}

console.log('[build-web] done -> ' + OUT);
