import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [vue(), tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
  },
})
