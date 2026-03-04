# 题目语法（`quiz` 代码块）

使用统一的 `quiz` 代码块定义常见题型：

- `choice`：单选题 / 多选题
- `blank`：填空题
- `open`：问答题

## 代码块格式（YAML）

`quiz` 代码块按 YAML 解析，支持标准的键值、列表、多行文本等写法。

建议遵循以下写法：

- 使用 2 个空格缩进
- 使用 `key: value` 表达字段
- 使用 `- ...` 表达列表项（如 `options`、`blanks`）
- 多行文本可使用 `|`，并在后续行保持缩进
- 含特殊字符的字符串建议显式加引号
- 顶层未知字段会被解析器判定为语法错误
- 当前 `quiz` 语法不支持自定义扩展字段

多段题干示例：

````aimd
```quiz
id: quiz_open_multi_paragraph
type: open
stem: |
  第一段：请先描述实验现象。

  第二段：再解释该现象可能的原因，并给出依据。
rubric: 至少提到两个影响因素
```
````

如需了解 `parse_aimd` 的解析输出结构，请参考 API 文档：[AIMD 工具](../apis/markdown.md)。

## 用户作答后的保存数据结构

`quiz` 用户作答会以题目 `id` 作为键，存入 `data.quiz` 对象，并基于题目定义规则进行校验。

示例（只示意 `quiz` 部分）：

```json
{
  "quiz": {
    "quiz_choice_single_1": "A",
    "quiz_choice_multiple_1": ["A", "C"],
    "quiz_blank_1": {
      "b1": "21%"
    },
    "quiz_open_1": "因为温度和压强共同影响该现象。"
  }
}
```

对应关系：

- `choice + single` -> `str`（选项 key）
- `choice + multiple` -> `list[str]`（选项 key 列表）
- `blank` -> `dict[str, str]`（`blank_key -> 用户填写内容`）
- `open` -> `str`

Record 的整体结构请参考：[Record 数据结构](../data-structure/record.md)。

## 选择题（`type: choice`）

````aimd
```quiz
id: quiz_choice_single_1
type: choice
mode: single
score: 5
stem: 以下哪项是正确的？
options:
  - key: A
    text: 选项A内容
  - key: B
    text: 选项B内容
answer: A
```
````

必填字段：

- `id`
- `type: choice`
- `mode`：`single` 或 `multiple`
- `stem`
- `options`：非空列表，每个选项包含 `key` 与 `text`

可选字段：

- `score`：非负数
- `answer`：标准答案（选项键）
- `default`：记录界面的初始选项键

## 填空题（`type: blank`）

````aimd
```quiz
id: quiz_blank_1
type: blank
score: 3
stem: 空气中氧气约占 [[b1]]
blanks:
  - key: b1
    answer: 21%
```
````

必填字段：

- `id`
- `type: blank`
- `stem`：包含 `[[key]]` 形式的占位符
- `blanks`：非空列表，每项包含 `key` 与 `answer`

占位符一致性规则：

- `blanks` 中每个 `key` 都必须在 `stem` 中出现
- `stem` 中每个占位符都必须在 `blanks` 中定义
- 每个 `key` 在 `stem` 中仅出现一次

## 问答题（`type: open`）

````aimd
```quiz
id: quiz_open_1
type: open
score: 10
stem: 请解释该现象
rubric: 至少提到两个影响因素
```
````

必填字段：

- `id`
- `type: open`
- `stem`

可选字段：

- `score`
- `rubric`
