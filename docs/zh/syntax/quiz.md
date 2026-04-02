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
- 如需自动评分，请使用文档中定义的 `grading` 字段

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

## 自动评分

`quiz` 的用户答案仍然只保存在 `data.quiz`。自动评分结果通常应单独保存为一份 grade report，而不是覆盖原始作答。

这里的 “单独保存” 指的是数据结构上分开，而不一定要求必须是单独文件。常见做法包括：

- 作为 API 返回结果中的一个独立字段，例如 `grade_report`
- 作为数据库中的一条关联评分记录
- 在导出场景下保存为单独的 JSON 文件

核心原则只有一个：保留 `data.quiz` 中的原始作答，不要把评分结果直接写回原答案字段。

推荐做法：

- `choice` 默认使用精确匹配
- `blank` 使用规范化匹配、别名集合、数值容差等确定性规则
- `open` 使用 rubric 评分，必要时再接入大模型 provider

如果你要接入大模型评分：

- AIMD 中只写 `provider: teacher_default` 这样的 provider 名称
- 这里的 provider 名称只是一个逻辑标识，不要求你真的部署一个名为 `teacher_default` 的服务
- 宿主系统可以把它映射到后端配置、某个外部模型 API，或者本地模型/内部评分流程
- 真正的 API key 放在宿主应用或后端服务配置中
- 正式考试场景建议由服务端完成评分，不要把真实 key 下发到浏览器

### `provider` 是什么

`provider` 更像是一个“评分配置名”或“评分通道名”，而不是固定的服务地址。

例如：

- `teacher_default`：当前老师的默认评分配置
- `school_exam_llm`：学校考试专用评分配置
- `chemistry_lab_v1`：某门课程的评分配置

典型流程是：

1. AIMD 中写 `provider: teacher_default`
2. 前端把题目、答案、`provider` 一起发给你的后端
3. 后端根据这个名字查到真实配置
4. 后端再去调用外部模型 API、内部模型服务，或者人工复核流程

因此，`provider` 本身不是 API key，也不是必须存在的独立服务名。

## 评分结果建议

推荐把评分结果保存为独立结构，例如：

```json
{
  "quiz": {
    "quiz_open_1": {
      "earned_score": 4,
      "max_score": 5,
      "status": "partial",
      "feedback": "提到了反应速率，但没有充分说明稳定性。"
    }
  },
  "summary": {
    "total_earned_score": 4,
    "total_max_score": 5,
    "review_required_count": 0
  }
}
```

如果你希望把它和 Record 一起返回，可以采用这样的结构：

```json
{
  "data": {
    "quiz": {
      "quiz_open_1": "学生原始答案"
    }
  },
  "grade_report": {
    "quiz": {
      "quiz_open_1": {
        "earned_score": 4,
        "max_score": 5,
        "status": "partial"
      }
    },
    "summary": {
      "total_earned_score": 4,
      "total_max_score": 5,
      "review_required_count": 0
    }
  }
}
```

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
    explanation: 选择 A 的讲解
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
- `answer`：标准答案（选项键）。如果使用 `grading.strategy: option_points`，可以不写 `answer`
- `default`：记录界面的初始选项键
- `grading`：评分策略。选择题常见用法是开启多选题部分得分，或直接按选项给分

`options` 中还可以额外写：

- `explanation`：该选项的讲解文本。它不参与评分，但宿主或 recorder 可以在练习场景中按需显示，帮助学生理解为什么这个选项对或错

部分得分示例：

````aimd
```quiz
id: quiz_choice_multiple_1
type: choice
mode: multiple
score: 6
stem: 以下哪些项目必须记录？
options:
  - key: A
    text: 样本编号
  - key: B
    text: 操作时间
  - key: C
    text: 操作者
  - key: D
    text: 天气情况
answer: [A, B, C]
grading:
  strategy: partial_credit
```
````

`partial_credit` 适用于多选题。它的作用是：用户不必必须全对才得分，选对正确项可以拿到部分分数，但错选也会扣掉相应部分，最终得分会限制在 `0..score` 范围内。

当前规则可以简单理解为：

- 得分比例 = `(选对数量 - 错选数量) / 正确答案总数`
- 如果比例小于 `0`，按 `0` 计算
- 如果比例大于 `1`，按 `1` 计算
- 最终得分 = `得分比例 * score`

以上面这个“四选三、满分 6 分”的例子来说：

- 只选 `A`：`(1 - 0) / 3 * 6 = 2` 分
- 选 `A, B`：`(2 - 0) / 3 * 6 = 4` 分
- 选 `A, B, C`：`(3 - 0) / 3 * 6 = 6` 分
- 全选 `A, B, C, D`：`(3 - 1) / 3 * 6 = 4` 分
- 只选 `D`：`(0 - 1) / 3 * 6 = -2`，最终按 `0` 分计算

这个策略适合教学、练习和作业场景，用来区分“部分掌握”和“完全掌握”。如果你希望多选题只有全对才得分，请不要设置它，保留默认的精确匹配即可。

按选项给分示例：

````aimd
```quiz
id: quiz_choice_single_points_1
type: choice
mode: single
score: 5
stem: 下列说法中，哪一项最合理？
options:
  - key: A
    text: 完全正确
  - key: B
    text: 基本合理但不完整
  - key: C
    text: 有明显问题
grading:
  strategy: option_points
  option_points:
    A: 5
    B: 3
    C: 0
```
````

如果是多选题，系统会把用户选中的选项分数相加，并自动限制在 `0..score` 范围内。为了避免“全选拿高分”，可以给明显错误的选项设置负分：

````aimd
```quiz
id: quiz_choice_multiple_points_1
type: choice
mode: multiple
score: 4
stem: 以下哪些项目必须记录？
options:
  - key: A
    text: 样本编号
  - key: B
    text: 操作时间
  - key: C
    text: 操作者
  - key: D
    text: 天气情况
grading:
  strategy: option_points
  option_points:
    A: 1.5
    B: 1.5
    C: 1
    D: -1
```
````

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

可选字段：

- `score`
- `default`
- `grading`

自动评分示例：

````aimd
```quiz
id: quiz_blank_1
type: blank
score: 3
stem: 空气中氧气约占 [[b1]]
blanks:
  - key: b1
    answer: 21%
grading:
  strategy: normalized_match
  blanks:
    - key: b1
      accepted_answers: ["21%", "21 %", "0.21"]
      normalize: ["trim", "remove_spaces"]
      numeric:
        target: 21
        tolerance: 0.5
        unit: "%"
```
````

其中：

- `accepted_answers`：允许的等价答案集合
- `normalize`：作答文本规范化规则。这里使用的是预置规则名，而不是自定义脚本
- `numeric`：按数值容差评分，适合带单位或近似值

只有当你在某个 blank 的评分规则中显式写了 `numeric` 字段时，系统才会触发数值解析与容差比较；如果不写，系统只会按文本匹配规则处理这个空。

`numeric` 的字段含义是：

- `target`：目标数值，必填
- `tolerance`：允许误差，可选
- `unit`：单位，可选。只有在你希望系统先去掉答案末尾单位再比较数值时才需要填写

如果题目本身是纯数字，没有单位，可以直接省略 `unit`，例如：

```yaml
numeric:
  target: 7
  tolerance: 0.2
```

当前实现里，系统不会去做“从自然语言里猜单位”的复杂抽取。它采用的是更确定的规则：

1. 先把全角字符转成半角，并去掉首尾空白
2. 如果配置了 `unit`，就尝试从答案末尾去掉这个单位
3. 再把剩余部分按数值解析

因此下面这些通常都能识别：

- `21%`
- `21 %`
- `２１％`
- `1,200 mg`（配置 `unit: "mg"` 时）

而下面这些通常不能直接识别为数值：

- `约21%`
- `百分之21`
- `mg21`

也就是说，`unit` 不是靠“智能识别”出来的，而是靠你在规则里明确声明后，系统再从答案末尾按规则剥离。

当前支持的 `normalize` 规则有：

- `trim`：去掉首尾空白
- `lowercase`：转成小写
- `collapse_whitespace`：把连续空白压缩成一个空格
- `remove_spaces`：移除所有空白字符
- `fullwidth_to_halfwidth`：把全角字符转换成半角字符

如果没有显式写 `normalize`，系统默认会使用：

```yaml
["trim", "collapse_whitespace"]
```

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
- `grading`

本地 rubric 自动评分示例：

````aimd
```quiz
id: quiz_open_1
type: open
score: 5
stem: 请解释为什么这一步需要控温
grading:
  strategy: keyword_rubric
  rubric_items:
    - id: rate
      points: 2
      desc: 提到反应速率
      keywords: ["反应速率", "速率"]
    - id: stability
      points: 3
      desc: 提到样品稳定性
      keywords: ["稳定性", "样品稳定"]
```
````

如果要接入大模型评分，可以改成：

````aimd
```quiz
id: quiz_open_llm_1
type: open
score: 10
stem: 请综合说明该现象产生的原因
grading:
  strategy: llm_rubric
  provider: teacher_default
  require_review_below: 0.8
  rubric_items:
    - id: factor_a
      points: 5
      desc: 至少说明一个关键因素
    - id: factor_b
      points: 5
      desc: 给出合理依据
```
````

这里的 `teacher_default` 只是一个配置名。典型流程是：前端把题目、答案和 `provider` 一起发给你的后端，后端再根据这个名字选择真实的模型、prompt 模板和密钥，然后调用外部 API 或内部模型完成评分。

说明：

- `provider` 是宿主系统里的评分 provider 名称，不是明文 API key
- 如果使用 provider / 大模型评分，后端必须返回结构化评分结果对象，而不是自由文本
- 推荐至少返回 `earned_score`、`max_score`、`status`、`method`，必要时再补 `feedback`、`confidence`、`review_required`
- 如果 provider 只返回一段自然语言文本，系统不会自动从中可靠提取得分；当前实现会把这类结果标记为 `needs_review`
- `require_review_below` 是一个 `0..1` 的置信度阈值。例如 `0.8` 表示：当评分置信度低于 `0.8` 时，应把该题标记为需要人工复核
- 对内置 `keyword_rubric` 评分，这个阈值会由系统直接应用
- 对 `llm` / `llm_rubric` 这类 provider 评分，后端应读取这个配置，并根据返回的 `confidence` 决定是否把 `review_required` 设为 `true`
- `rubric_items` 建议始终保留，便于人工复核与评分解释

例如，后端返回给评分器的结构化结果可以是：

```json
{
  "earned_score": 8,
  "max_score": 10,
  "status": "partial",
  "method": "llm",
  "feedback": "提到了主要因素，但论证还不够完整。",
  "confidence": 0.84,
  "review_required": false
}
```
