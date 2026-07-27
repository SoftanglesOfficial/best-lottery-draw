import type { ForgeConfig } from '@electron-forge/shared-types';
import fs from 'node:fs';
import path from 'node:path';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const MAIN_RUNTIME_ROOT_DEPS = [
  'drizzle-orm',
  'electron-squirrel-startup',
  'pg',
  'update-electron-app',
] as const;

function collectDependencyTree(
  depName: string,
  modulesRoot: string,
  collected: Set<string>,
): void {
  if (collected.has(depName)) return;
  const depPath = path.join(modulesRoot, depName);
  if (!fs.existsSync(depPath)) return;
  collected.add(depName);

  const pkgPath = path.join(depPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  for (const child of Object.keys({
    ...pkg.dependencies,
    ...pkg.optionalDependencies,
  })) {
    collectDependencyTree(child, modulesRoot, collected);
  }
}

function copyMainRuntimeDependencies(projectDir: string, buildPath: string): void {
  const srcModules = path.join(projectDir, 'node_modules');
  const destModules = path.join(buildPath, 'node_modules');
  fs.mkdirSync(destModules, { recursive: true });

  const depsToCopy = new Set<string>();
  for (const dep of MAIN_RUNTIME_ROOT_DEPS) {
    collectDependencyTree(dep, srcModules, depsToCopy);
  }

  for (const dep of depsToCopy) {
    const src = path.join(srcModules, dep);
    const dest = path.join(destModules, dep);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true, dereference: true });
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'best-12',
    icon: 'assets/icon',
    asar: {
      unpack: '**/node_modules/{pg,pg-native,pg-pool,pg-protocol}/**',
    },
    win32metadata: {
      ProductName: 'Best-12 Morning Booking',
      CompanyName: 'Softangles',
      FileDescription: 'Lottery Management System',
    },
    ...({ productName: 'Best-12' } as Record<string, string>),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'best_12',
      setupExe: 'Best-12-Setup.exe',
      setupIcon: 'assets/icon.ico',
      ...({
        shortcutName: 'Best-12',
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
      } as Record<string, unknown>),
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      copyMainRuntimeDependencies(process.cwd(), buildPath);
    },
  },
};

export default config;
