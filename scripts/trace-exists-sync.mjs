import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const orig = fs.existsSync.bind(fs);

fs.existsSync = (p, ...rest) => {
  const ok =
    typeof p === 'string' ||
    Buffer.isBuffer(p) ||
    (typeof URL !== 'undefined' && p instanceof URL);
  if (!ok) {
    console.error('\n[DEP0187 probe] existsSync got:', p, typeof p);
    console.error(new Error('stack').stack?.split('\n').slice(0, 15).join('\n'));
  }
  return orig(p, ...rest);
};

const { api } = require('@electron-forge/core');
await api.make({ dir: process.cwd() });
