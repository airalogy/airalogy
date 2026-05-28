import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import tsconfigPaths from 'vite-tsconfig-paths'

const normalizeBase = (value?: string) => {
  if (!value || value === '/') return '/'

  let normalized = value
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (!normalized.endsWith('/')) normalized = `${normalized}/`

  return normalized.replace(/\/{2,}/g, '/')
}

const base = normalizeBase(process.env.PROTOCOL_DEMO_BASE)

export default defineConfig(({ command }) => ({
  base,
  plugins: [
    vue(),
    command === 'serve' ? VueDevTools() : null,
    tsconfigPaths({ root: '../..' }),
  ].filter(Boolean),
  server: {
    port: 5190,
    open: true,
  },
}))
