import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        parser: resolve(__dirname, 'src/parser/index.ts'),
        syntax: resolve(__dirname, 'src/syntax/index.ts'),
        types: resolve(__dirname, 'src/types/index.ts'),
        utils: resolve(__dirname, 'src/utils/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'unified',
        'remark-parse',
        'remark-gfm',
        'remark-math',
        'remark-breaks',
        'remark-rehype',
        'unist-util-visit',
        'vfile',
        'shiki',
      ],
    },
  },
})
