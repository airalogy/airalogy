<script setup>
import { withBase } from 'vitepress'

const demoRoot = import.meta.env.DEV
  ? 'http://localhost:5188'
  : withBase('/demo')

const demoPages = [
  { label: '案例', path: '/examples', desc: '查看仓库内 AIMD 场景案例' },
  { label: '完整工作流', path: '/full', desc: '编辑、渲染、记录一体化页面' },
  { label: 'Core 解析器', path: '/core', desc: '查看 AST 与字段提取结果' },
  { label: 'Editor 编辑器', path: '/editor', desc: 'AIMD 编写与插入交互' },
  { label: 'Renderer 渲染器', path: '/renderer', desc: 'HTML / Vue 渲染预览' },
  { label: 'Recorder 记录器', path: '/recorder', desc: '结构化录入控件示例' },
]

const linkTo = path => `${demoRoot}/#${path}`
</script>

# Demo

为避免文档页面过于拥挤，演示页改为单独打开。

<div class="aimd-demo-actions">
  <a :href="linkTo('/full')" class="aimd-demo-button" target="_blank" rel="noreferrer">
    打开完整 Demo
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

本地开发：

- 文档站：`pnpm docs:dev`
- Demo：`pnpm dev:demo`

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
