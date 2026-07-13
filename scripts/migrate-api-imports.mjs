#!/usr/bin/env node
/** One-shot codemod: named lib/api imports -> import { api } + api.method calls */
import fs from 'node:fs';
import path from 'node:path';

const rendererRoot = path.resolve(import.meta.dirname, '../src/renderer');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !full.endsWith('lib/api.ts')) out.push(full);
  }
  return out;
}

const importRe =
  /import\s*\{([^}]+)\}\s*from\s*(['"])([^'"]*lib\/api)\2\s*;?/g;

for (const file of walk(rendererRoot)) {
  let content = fs.readFileSync(file, 'utf8');
  const names = new Set();
  const importPaths = new Set();

  for (const match of content.matchAll(importRe)) {
    const [, namesBlock, , importPath] = match;
    importPaths.add(importPath);
    for (const part of namesBlock.split(',')) {
      const name = part.trim().replace(/^type\s+/, '');
      if (name) names.add(name);
    }
  }

  if (names.size === 0) continue;

  if (importPaths.size > 1) {
    console.warn('skip multi-path', file);
    continue;
  }

  content = content.replace(importRe, (full, namesBlock, quote, importPath) => {
    const fnNames = namesBlock
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('type '));
    if (fnNames.length === 0) return full;
    return `import { api } from ${quote}${importPath}${quote};`;
  });

  for (const name of names) {
    const re = new RegExp(`(?<!api\\.)\\b${name}\\b`, 'g');
    content = content.replace(re, `api.${name}`);
  }

  fs.writeFileSync(file, content);
  console.log('updated', path.relative(rendererRoot, file));
}
