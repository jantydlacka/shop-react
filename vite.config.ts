/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { copyFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Demo build: ships the MSW worker script and a 404.html copy of index.html,
// so deep links on GitHub Pages load the app.
function demoAssets(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'demo-assets',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'mockServiceWorker.js',
        source: readFileSync(join(root, 'node_modules/msw/lib/mockServiceWorker.js')),
      })
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demo = mode === 'demo'
  return {
    plugins: [react(), ...(demo ? [demoAssets()] : [])],
    build: demo ? { outDir: 'dist-demo' } : {},
    server: {
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:8088',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      globals: false,
    },
  }
})
