# AIMD 语法导览

这个示例是 `apps/aimd-demo` 使用的标准交互式语法导览。它不是某个具体业务场景案例，而是把常见 AIMD 结构集中在一个文件中，方便用户直接查看和试用。

## 覆盖内容

- 标量变量和结构化内置字段类型。
- Markdown、代码、JSON、YAML 和序列字段。
- 变量表格，以及 Markdown 表格中的内联变量。
- 浏览器侧 client assigner，包括自动计算和手动列表赋值。
- 图、文献引用、BibTeX refs、步骤、嵌套步骤、检查点、计时器、引用和题目。
- Markdown 表格、引用块、CriticMarkup 审阅标记、行内公式和块级公式等渲染能力。

## 使用方式

在 AIMD renderer、recorder 或 demo 应用中打开 [protocol.aimd](./protocol.aimd)。这个文件用于语法导览，因此新增用户可见的 AIMD 字段体验时，优先在这里加入一个简洁示例。
