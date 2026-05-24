# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` 提供 AIMD 记录场景的样式、可复用录入组件，以及组合式的协议编辑 + 记录工作面。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；这些页面只描述前端 recorder 行为。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 核心能力

- 通过 `@airalogy/aimd-recorder/styles` 提供 recorder 样式。
- 提供协议内联录入组件 `AimdRecorder`。
- 提供组合式编辑器组件 `AimdRecorderEditor`。
- 提供可复用题目控件 `AimdQuizRecorder`。
- 内置 `CurrentTime`、`UserName`、`AiralogyMarkdown`、`DNASequence` 等 recorder widget。
- 前端受限的 `assigner runtime=client` 可在本地执行。

## 导航

- [AimdRecorder](/zh/packages/aimd-recorder/recorder)：在协议正文里直接渲染 recorder 输入控件。
- [AimdRecorderEditor](/zh/packages/aimd-recorder/recorder-editor)：一边编辑 AIMD 结构，一边继续填写 recorder 数据。
- [自定义](/zh/packages/aimd-recorder/customization)：适配字段组件、覆盖标签、或注入按 type 的专用行为。
