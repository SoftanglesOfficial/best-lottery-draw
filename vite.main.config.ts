import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

/** Vite lib mode bundles `dependencies` unless they are marked external. */
const productionDependencies = Object.keys(pkg.dependencies ?? {});

const nodeBuiltins = [
  'electron',
  'electron/main',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

function isMainExternal(id: string): boolean {
  if (nodeBuiltins.includes(id)) return true;

  for (const dep of productionDependencies) {
    if (id === dep || id.startsWith(`${dep}/`)) return true;
  }

  const normalized = id.replace(/\\/g, '/');
  for (const dep of productionDependencies) {
    if (normalized.includes(`/node_modules/${dep}/`)) return true;
  }

  return false;
}

/** Restart Electron main process when the main bundle rebuilds in dev. */
function restartElectronMain(): Plugin {
  let isInitialBuild = true;

  return {
    name: 'restart-electron-main',
    closeBundle() {
      if (isInitialBuild) {
        isInitialBuild = false;
        return;
      }
      if (process.stdin.isTTY) {
        process.stdin.emit('data', Buffer.from('rs\n'));
      }
    },
  };
}

/** Forge config merge drops external functions — apply after merge. */
function forceMainExternalsPlugin(): Plugin {
  return {
    name: 'force-main-externals',
    configResolved(resolved) {
      resolved.build.rollupOptions ??= {};
      resolved.build.rollupOptions.external = isMainExternal;
    },
  };
}

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: isMainExternal,
      output: {
        format: 'cjs',
        entryFileNames: 'main.js',
      },
    },
    commonjsOptions: {
      ignoreDynamicRequires: true,
    },
    minify: false,
  },
  resolve: {
    conditions: ['node'],
    mainFields: ['module', 'main'],
  },
  plugins: [forceMainExternalsPlugin(), restartElectronMain()],
});
