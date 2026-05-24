import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        html: resolve(__dirname, 'src/html/index.ts'),
        vue: resolve(__dirname, 'src/vue/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        '@airalogy/aimd-core',
        'unified',
        'remark-parse',
        'remark-gfm',
        'remark-math',
        'remark-breaks',
        'remark-rehype',
        'rehype-raw',
        'rehype-katex',
        'hast-util-to-html',
        'shiki',
        'vfile',
      ],
    },
  },
})
