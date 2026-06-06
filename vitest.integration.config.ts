import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/main/**/*.{ts,tsx}']
    }
  }
})
