import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: './', // Use relative paths for Electron
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'electron-app/main.ts',
        onstart(args) {
          // Notify the Renderer-Process to reload the page when the Main-Process build is complete, 
          // instead of restarting the entire Electron App.
          args.reload()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'electron-app/dist',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'electron-app/preload.ts',
        onstart(args) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
          // instead of restarting the entire Electron App.
          args.reload()
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: false,
            outDir: 'electron-app/dist',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    nodePolyfills({
      include: ['stream', 'util', 'buffer', 'events', 'string_decoder', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    // Use Node.js API in the Renderer-process
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  clearScreen: false,
})