import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue(), tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**', '**/*.mjs'],
    environment: 'happy-dom',
  },
})
