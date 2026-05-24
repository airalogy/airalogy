import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        monaco: resolve(__dirname, 'src/monaco.ts'),
        vue: resolve(__dirname, 'src/vue/index.ts'),
        embedded: resolve(__dirname, 'src/embedded.ts'),
        wysiwyg: resolve(__dirname, 'src/wysiwyg.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        '@airalogy/aimd-core',
        '@airalogy/aimd-renderer',
        '@codingame/monaco-vscode-editor-api',
        '@codingame/monaco-vscode-standalone-languages',
        '@milkdown/kit/core',
        '@milkdown/kit/preset/commonmark',
        '@milkdown/kit/preset/gfm',
        '@milkdown/kit/plugin/history',
        '@milkdown/kit/plugin/listener',
        '@milkdown/kit/plugin/clipboard',
        '@milkdown/kit/plugin/indent',
        '@milkdown/kit/plugin/trailing',
        '@milkdown/kit/plugin/block',
        '@milkdown/kit/plugin/slash',
        '@milkdown/kit/utils',
        '@milkdown/kit/prose/view',
        '@milkdown/kit/prose/state',
        '@milkdown/kit/prose/model',
        '@milkdown/vue',
        '@milkdown/theme-nord/style.css',
        'monaco-editor',
        'shiki',
      ],
    },
  },
})
