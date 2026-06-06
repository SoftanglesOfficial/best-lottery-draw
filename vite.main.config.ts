import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

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

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: ['pg', 'pg-native', 'electron-store'],
    },
  },
  plugins: [restartElectronMain()],
});
