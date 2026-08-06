import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist');
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'CNAME',
  '.nojekyll',
  'icons/icon-192x192.png',
  'icons/icon-192x192-maskable.png',
  'icons/icon-512x512.png',
  'icons/icon-512x512-maskable.png',
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(outputDirectory, file))) {
    throw new Error(`Production output is missing ${file}`);
  }
}

const manifest = JSON.parse(readFileSync(resolve(outputDirectory, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'ACC' || manifest.short_name !== 'ACC') {
  throw new Error('Production manifest must use the ACC application name');
}
if (manifest.start_url !== '/' || manifest.scope !== '/') {
  throw new Error('Production manifest start_url and scope must both be /');
}
if (manifest.display !== 'standalone' || manifest.orientation !== 'portrait') {
  throw new Error('Production manifest must use standalone portrait mode');
}

const index = readFileSync(resolve(outputDirectory, 'index.html'), 'utf8');
if (index.includes('/acc/')) throw new Error('Production index contains a /acc/ path');
if (!index.includes('manifest.webmanifest')) throw new Error('Production index has no manifest');

const assetFiles = readdirSync(resolve(outputDirectory, 'assets'));
if (!assetFiles.some((file) => file.endsWith('.js'))) {
  throw new Error('Production output has no JavaScript asset');
}
if (!assetFiles.some((file) => file.endsWith('.css'))) {
  throw new Error('Production output has no CSS asset');
}

const cname = readFileSync(resolve(outputDirectory, 'CNAME'), 'utf8').trim();
if (cname !== 'acc.dbuilder.eu') throw new Error('Production CNAME is incorrect');

console.log('Verified root production output, PWA files, icons, assets, and CNAME.');
