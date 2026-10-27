<script setup>
import { withBase } from 'vitepress'

const demoRoot = import.meta.env.DEV
  ? 'http://localhost:5188'
  : withBase('/demo')

const demoPages = [
  { label: '案例', path: '/examples', desc: '在一个工作台中查看 AIMD 案例、源码编辑、渲染预览、数据录入、字段和 Record 数据' },
  { label: 'Core 解析器', path: '/core', desc: '查看 AST 与字段提取结果' },
  { label: 'Editor 编辑器', path: '/editor', desc: 'AIMD 编写与插入交互' },
  { label: 'Renderer 渲染器', path: '/renderer', desc: 'HTML / Vue 渲染预览' },
  { label: 'Recorder 记录器', path: '/recorder', desc: '结构化录入控件示例' },
]

const linkTo = path => `${demoRoot}/#${path}`
</script>

# Airalogy Markdown Demo

为避免文档页面过于拥挤，Airalogy Markdown Demo 改为单独打开。案例页里的 Protocol 条目用于预览和填写 `protocol.aimd` 源码；需要引擎（Engine）执行赋值器（Assigner）的完整演示应放在更高一层的 Airalogy Protocol Demo。

<div class="aimd-demo-actions">
  <a :href="linkTo('/examples')" class="aimd-demo-button" target="_blank" rel="noreferrer">
    打开 Airalogy Markdown Demo
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

## 双语语法导览

“AIMD 语法导览”提供中文和英文版本。加载或重置此示例时会使用 Demo 当前语言，不会自动替换已保存的编辑草稿。两个版本保持字段 ID、枚举取值、引用、本地资源和赋值器一致，分别提供对应语言的标签、步骤标题、操作说明和题目。源文件位于 [examples/aimd/aimd-syntax-tour](https://github.com/airalogy/airalogy/tree/main/examples/aimd/aimd-syntax-tour)。

## AI 眼镜实验模板

两份模板的每个步骤均显式声明 `title`，用于人类阅读或眼镜宿主播报；`step` ID 仍用于定位、引用和记录关联。模板更新不会覆盖浏览器中已经保存的草稿。查看新版时可先在案例页载入模板；若要替换编辑页的旧草稿，请先导出需要保留的模板和记录，再主动加载新版。

在编辑页的“选择模板”或案例页的“切换示例”中，选择以“AI 眼镜实验指导”命名的“白醋总酸度滴定”（18 步）或“叶圆片光合作用与对照实验”（19 步）。两份中文版 Protocol 包含操作说明、人工确认、计时、重复测量、异常处理及眼镜交互事件表，无需启动 Engine。源文件与中英文测试指南位于 [examples/protocols](https://github.com/airalogy/airalogy/tree/main/examples/protocols)。

先使用清水/空器具排练，实际实验前完成本地安全审核与预实验。它们不是已验证 SOP，也不表示 Demo 已接入眼镜相机或语音系统；这些功能和强制步骤拦截由宿主实现。可用现有 Recorder 手工填写并保存草稿，计算与科学解释需要人工复核。

## 保存模板与记录

输入框工具栏中的“高级 / 自定义”列出已注册的 Airalogy 类型，也允许自由填写类型表达式。检查点名称选填，稳定 ID 自动生成。鼠标悬停或键盘聚焦“导入包”可查看完整说明；提示浮层不会被工作区裁切，会避让屏幕边缘，并支持 Esc 关闭。

工作区右上角常显“显示字段信息”开关，首次进入默认开启。关闭后切换为简洁填空界面；用户选择会自动保存在当前浏览器，下次进入时优先恢复，不会被应用默认值覆盖。编辑与填写使用同一偏好，并排模式下两侧同步。该偏好不属于 AIMD 模板、Record 值或导出的 `.aira` 包；其他平台集成时可通过组件的 `field-display` 属性配置默认显示方式，并自行管理用户偏好。

在线编辑页可以在可视化文档中编辑输入框并填写实际数据。AIMD 模板与 Record 值分别保存：例如 `{{var|temperature: float}}` 仍然是模板定义，填写的 `37.5` 保存在 Record 的 `data.var.temperature` 中，不会变成模板默认值。

- **草稿**：模板、填写值、Protocol 附件、Record 附件和当前导入记录的编辑状态一起自动保存到本机 IndexedDB；等待“草稿已保存到本机”后刷新可恢复。未填写完整的草稿不要求通过校验，也不会因为自动保存而分配正式记录 ID。
- **保存模板**：仅导出模板；没有本地资源时是 `.aimd`，有资源时是 Protocol `.aira`。不含当前填写值或 Record 附件。
- **保存记录 .aira**：先执行 Recorder 的前端校验，再导出当前一条记录、匹配的 Protocol 快照及可用附件。新记录第一次导出时生成 ID 和版本 1；内容不变的再次导出保持版本，修改数据或模板后再次导出递增版本。导入的记录继续使用原记录 ID。
- **重新导入**：将记录 `.aira` 通过“导入包”打开即可继续填写。导入多条记录时，切换记录会保留各自的草稿；“保存记录”只导出当前记录。

包内的 Protocol 快照包含当前源文件和本地资源；未修改的已导入 Protocol 保留其版本，修改后的本地快照使用内容哈希构成的 `local-...` 版本，不冒充已发布版本。正式输出前补充的图片 ID 会回写源文件并提示用户。

本机选择的 Record 附件会保存实际文件内容；只有外部文件引用、没有文件字节的附件仍是外部引用，导出后会明确提示。浏览器不会为此自动请求远程文件或发送数据到服务器。草稿不是备份，也不会跨浏览器、域名或端口同步；清除站点数据、隐私模式和存储配额都可能影响恢复。重要记录应及时导出。前端校验不执行自定义 Python `model.py`，权威校验和服务端提交仍由宿主系统负责。

职责边界：`aimd-editor` 编辑 AIMD 定义；`aimd-recorder` 管理填写值和交互校验；Demo/宿主负责草稿、记录 ID、版本与保存入口；`aira-core` 负责归档格式、文件及哈希。底层 `createRecordsAiraArchive` API 可打包共享同一 Protocol 的多条记录，并对 Record 附件进行 SHA-256 去重，具体用法见 [aira-core README](https://github.com/airalogy/airalogy/tree/main/packages/npm/aira-core#export-records)。

本地开发：

- 文档站：`pnpm docs:dev`
- Demo：`pnpm dev:demo`
- Protocol Demo：`pnpm dev:protocol-demo:full`

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
  border-radius: 8px;
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
