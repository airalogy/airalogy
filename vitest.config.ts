import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const projects = [
  {
    name: 'aimd-core',
    root: resolve(__dirname, 'packages/npm/aimd-core'),
    extends: resolve(__dirname, 'packages/npm/aimd-core/vitest.config.ts'),
  },
  {
    name: 'aimd-renderer',
    root: resolve(__dirname, 'packages/npm/aimd-renderer'),
    extends: resolve(__dirname, 'packages/npm/aimd-renderer/vitest.config.ts'),
  },
  {
    name: 'aimd-editor',
    root: resolve(__dirname, 'packages/npm/aimd-editor'),
    extends: resolve(__dirname, 'packages/npm/aimd-editor/vitest.config.ts'),
  },
  {
    name: 'aimd-recorder',
    root: resolve(__dirname, 'packages/npm/aimd-recorder'),
    extends: resolve(__dirname, 'packages/npm/aimd-recorder/vitest.config.ts'),
  },
]

export default defineConfig({
  test: {
    projects: projects.map(project => ({
      extends: project.extends,
      root: project.root,
      test: {
        name: project.name,
      },
    })),
  },
})
