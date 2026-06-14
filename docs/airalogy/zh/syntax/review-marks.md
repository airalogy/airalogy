# 审阅标记语法

Airalogy Markdown 支持普通 Markdown 文本中的 CriticMarkup 风格审阅标记。这类标记用于文档修订、Protocol 草稿审阅和报告批注；它不是数据字段，也不会在 `data.var`、`data.quiz` 或其他 Record payload 分区中生成条目。

## 形式

| 用途 | 语法 | 含义 |
| --- | --- | --- |
| 添加 | `{++新增文字++}` | 建议插入的文字。 |
| 删除 | `{--删除文字--}` | 建议移除的文字。 |
| 替换 | `{~~旧表述~>新表述~~}` | 用新文字替换旧文字。 |
| 注释 | `{>>审阅备注<<}` | 审阅者备注或编辑批注。 |
| 高亮 | `{==重点文字==}` | 标记需要审阅关注的内容。 |

示例：

```aimd
缓冲液应{~~通常~>始终~~}新鲜配制。{>>确认储存稳定性。<<}

反应开始时使用{++新鲜催化剂++}，删除{--未使用的加热步骤--}，并把{==温度漂移==}标为待审阅内容。
```

## 解析模型

审阅标记属于 Markdown 层，而不是 AIMD 字段层。`parse_aimd()` 等 Python helper 会把它们保留为普通 Markdown 文本；`@airalogy/aimd-renderer`、recorder 预览和 Airalogy Reader 等前端 renderer 可以把它们渲染为语义化审阅标注。

如果宿主需要 AST 层面的审阅标记节点，`@airalogy/aimd-core` 暴露了 `remarkCriticMarkup`。该插件会生成 `criticAddition`、`criticDeletion`、`criticSubstitution`、`criticComment`、`criticHighlight` 节点，但不会改变 AIMD 字段提取结果。

## 原样文本场景

行内代码和 fenced 代码块中的审阅标记会保留为原始文本：

````aimd
说明语法时使用 `{++literal++}`。

```text
{--代码块中不会解析--}
```
````

## 转义

如果普通 Markdown 文本中需要原样显示审阅标记，可以在起始花括号前加反斜杠：

```aimd
\{++这不是审阅标记++}
```

## 与 GFM 的关系

替换语法使用 `~~`，而 GitHub Flavored Markdown 的删除线也使用 `~~`。Airalogy renderer 会在 GFM 解析之前保护替换片段，因此 `{~~旧表述~>新表述~~}` 会被识别为审阅替换，而不是删除线。
