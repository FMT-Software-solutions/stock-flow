import fs from 'node:fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * Refuses to produce a build that is already broken.
 *
 * Everything a Vite build reads from the environment is compiled into the
 * bundle. The desktop app is then packaged, signed and published — so a value
 * that was wrong at build time is wrong on every customer's machine, and the
 * only remedy is another release.
 *
 * Print Suite Pro shipped exactly that: a release with VITE_BACKEND_URL
 * missing, so the bundle fell back to http://localhost:3001/api and every SMS
 * and credit purchase failed with "Failed to fetch" against a server on the
 * customer's own computer. The env files here are gitignored too, so any clean
 * checkout is one build away from the same release.
 */
function verifyBuildEnv(required: string[]): Plugin {
  return {
    name: 'verify-build-env',
    apply: 'build',
    config(_config, { mode }) {
      const dir = process.cwd();
      const env = loadEnv(mode, dir, 'VITE_');
      const problems: string[] = [];

      for (const key of required) {
        if (!env[key]) problems.push(`${key} is not set`);
      }

      for (const [key, value] of Object.entries(env)) {
        if (/localhost|127\.0\.0\.1/.test(value)) {
          problems.push(`${key} points at this machine (${value})`);
        }
      }

      // Read from the files rather than through loadEnv, which folds in
      // process.env — where the build script legitimately sets NODE_ENV. Only
      // a declaration in a .env file is a problem: Vite applies it to the
      // build and React ships in development mode, which means jsxDEV calls,
      // dev-only warnings and a considerably larger bundle.
      for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
        const full = path.join(dir, file);
        if (!fs.existsSync(full)) continue;
        const declared = /^\s*NODE_ENV\s*=\s*(.+)$/m.exec(fs.readFileSync(full, 'utf8'));
        if (declared && declared[1].trim() !== 'production') {
          problems.push(
            `${file} sets NODE_ENV=${declared[1].trim()}, which ships a development React build`
          );
        }
      }

      if (problems.length > 0) {
        throw new Error(
          '\n\nRefusing to build. These values get compiled into the bundle and ' +
            'cannot be\ncorrected once the installer ships:\n\n' +
            problems.map((p) => `  - ${p}`).join('\n') +
            '\n\nSet them in .env.local (see .env.example), then build again.\n'
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    verifyBuildEnv([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_BACKEND_URL',
      'VITE_DOWNLOADS_PAGE_URL',
    ]),
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['stream', 'util', 'buffer', 'events', 'string_decoder', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  base: './', // Use relative paths for Electron renderer
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
  },
});
