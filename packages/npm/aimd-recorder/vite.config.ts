import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        components: resolve(__dirname, 'src/components/index.ts'),
        composables: resolve(__dirname, 'src/composables/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        '@vueuse/core',
        'naive-ui',
        '@airalogy/aimd-editor',
        '@airalogy/aimd-editor/embedded',
        '@airalogy/aimd-editor/wysiwyg',
        '@airalogy/aimd-core',
        '@airalogy/aimd-renderer',
      ],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
})
