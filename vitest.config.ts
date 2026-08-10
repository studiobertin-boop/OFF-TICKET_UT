import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    // I worktree di Claude Code sono copie del repo a un altro commit: i loro test
    // girerebbero contro codice non più attuale e farebbero fallire la suite locale.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/.worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
