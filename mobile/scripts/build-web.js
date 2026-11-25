// Cross-platform web export for Cloudflare Workers static assets.
// Avoids inline env syntax (VAR=x cmd), which fails in Windows cmd/PowerShell npm scripts.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.expo-build');

fs.rmSync(outDir, { recursive: true, force: true });

const result = spawnSync('npx expo export --platform web --output-dir .expo-build --clear', {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' },
});
if (result.status !== 0) process.exit(result.status ?? 1);

// Workers "404-page" handling serves the nearest 404.html; Expo names it +not-found.html.
fs.copyFileSync(path.join(outDir, '+not-found.html'), path.join(outDir, '404.html'));

// Expo fingerprints JS, CSS, fonts and images, so they can be cached for a year.
fs.writeFileSync(path.join(outDir, '_headers'), [
  '/_expo/static/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
].join('\n'));

const apiUrl = process.env.EXPO_PUBLIC_API_URL || readEnvFile('.env.production') || readEnvFile('.env');
console.log(`\nWeb build ready in .expo-build (API: ${apiUrl || 'http://127.0.0.1:5000 fallback'})`);

function readEnvFile(name) {
  try {
    const match = fs.readFileSync(path.join(root, name), 'utf8').match(/^EXPO_PUBLIC_API_URL=(.*)$/m);
    return match && match[1].trim();
  } catch {
    return null;
  }
}
