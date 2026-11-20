/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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
