<script setup>
import { withBase } from 'vitepress'

const demoRoot = import.meta.env.DEV
  ? 'http://localhost:5188'
  : withBase('/demo')

const demoPages = [
  { label: 'Examples', path: '/examples', desc: 'Repository AIMD scenario examples' },
  { label: 'Full Workflow', path: '/full', desc: 'Editor + render + record in one page' },
  { label: 'Core Parser', path: '/core', desc: 'AST and extracted AIMD fields' },
  { label: 'Editor', path: '/editor', desc: 'AIMD authoring experience' },
  { label: 'Renderer', path: '/renderer', desc: 'HTML / Vue render output preview' },
  { label: 'Recorder', path: '/recorder', desc: 'Structured data input UI' },
]

const linkTo = path => `${demoRoot}/#${path}`
</script>

# Demo

Use the demo in a separate page for a cleaner reading experience.

<div class="aimd-demo-actions">
  <a :href="linkTo('/full')" class="aimd-demo-button" target="_blank" rel="noreferrer">
    Open Full Demo
  </a>
</div>

<div class="aimd-demo-list">
  <a
    v-for="item in demoPages"
    :key="item.path"
    :href="linkTo(item.path)"
    class="aimd-demo-card"
    target="_blank"
    rel="noreferrer"
  >
    <div class="aimd-demo-card__title">{{ item.label }}</div>
    <div class="aimd-demo-card__desc">{{ item.desc }}</div>
  </a>
</div>

In local development:

- `pnpm docs:dev` for docs
- `pnpm dev:demo` for demo app

<style scoped>
.aimd-demo-actions {
  margin: 14px 0 18px;
}

.aimd-demo-button {
  display: inline-block;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid #c9d8ff;
  background: #eaf1ff;
  color: #1f4fbb;
  text-decoration: none;
  font-weight: 600;
}

.aimd-demo-button:hover {
  background: #dfe9ff;
}

.aimd-demo-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}

.aimd-demo-card {
  display: block;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  text-decoration: none;
}

.aimd-demo-card:hover {
  border-color: #bfd1ff;
  background: #fafcff;
}

.aimd-demo-card__title {
  color: #1f2937;
  font-weight: 600;
  font-size: 14px;
}

.aimd-demo-card__desc {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
}
</style>
