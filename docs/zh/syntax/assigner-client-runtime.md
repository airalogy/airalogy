# 前端 Client Runtime Assigner 设计说明

本文专门解释 `assigner runtime=client` 的语法设计。  
如果你还没有看过 Assigner 的总览，请先阅读 [Assigner 语法](./assigner.md)。

## 最基本结构

对于新手，最先记住这一句就够了：

```js
assigner(config, fn);
```

这里的 `config` 和 `fn` 只是解释语法时使用的占位名字，真正写代码时不需要把变量名真的写成 `config` / `fn`。它的含义可以直接理解为：

- `assigner(...)`：注册一个 client runtime assigner。
- 第一个参数 `config`：声明这个 assigner 的元信息。
- 第二个参数 `fn`：声明这个 assigner 的实际计算逻辑。

完整示例：

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["var_1", "var_2"],
    assigned_fields: ["var_3"],
  },
  function calculate_var_3({ var_1, var_2 }) {
    return {
      var_3: Math.round((var_1 + var_2) * 100) / 100,
    };
  }
);
```
````

## 多个 assigner 怎么写？

当前推荐并约定：

- **一个 client assigner 对应一个 `assigner runtime=client` 代码块**。
- 如果一个 AIMD 文档里需要多个 client assigner，就写多个 block。
- 不建议在同一个 block 里并列书写多个 `assigner(...)`。

例如：

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["a", "b"],
    assigned_fields: ["x"],
  },
  function calculate_x({ a, b }) {
    return {
      x: a + b,
    };
  }
);
```

```assigner runtime=client
assigner(
  {
    mode: "manual",
    dependent_fields: ["x"],
    assigned_fields: ["y"],
  },
  function calculate_y({ x }) {
    return {
      y: x * 2,
    };
  }
);
```
````

这样做的好处是：

- 一个 block 对应一个 assigner node，最容易理解；
- 依赖图提取和报错定位更清楚；
- 文档、AI 生成和代码审阅也更稳定。

## 为什么设计成两部分？

client assigner 的设计被有意分成了两层：

- **声明层**：说明“这个 assigner 依赖哪些字段、负责写哪些字段、以什么模式触发”。
- **计算层**：说明“当依赖字段齐备时，具体怎么算”。

这样拆分有三个直接好处：

1. 依赖关系是显式的，便于做全局 assigner 图校验。
2. 复杂计算可以放心写在函数里，不必拆成很多零碎表达式。
3. 语法整体又尽量贴近 JavaScript，便于复用高亮、AI 生成和 AST 工具。

## `assigner(...)` 是什么？

`assigner(...)` 不是 JavaScript 内置函数，而是 AIMD / Airalogy runtime 提供的**特殊注册入口**。

可以把它理解成：

- Python 里：`@assigner(...)`
- JS 里：`assigner(...)`

它们都不是语言内置能力，而是协议系统定义的“Assigners 注册语法”。

## `config` 中有哪些参数？

`config` 是一个普通的 JavaScript 对象。当前核心参数包括：

- `mode`
  表示触发模式。在协议语义上，client runtime 应支持 `auto`、`auto_first`、`manual`。其中 `manual` 不自动执行，而是等待前端显式触发。
- `dependent_fields`
  一个字符串数组，表示这个 assigner 的输入字段列表。
- `assigned_fields`
  一个字符串数组，表示这个 assigner 负责写入的输出字段列表。

例如：

```js
{
  mode: "auto",
  dependent_fields: ["var_1", "var_2"],
  assigned_fields: ["var_3"],
}
```

这段配置可以直观理解为：

- 当 `var_1` 和 `var_2` 这两个输入字段齐备时，
- 以 `auto` 模式触发，
- 并计算写入 `var_3`。

如果改成：

```js
{
  mode: "manual",
  dependent_fields: ["var_1", "var_2"],
  assigned_fields: ["var_3"],
}
```

则语义变成：

- 这个 assigner 仍然依赖 `var_1` 和 `var_2`；
- 但它不会在依赖变化时自动运行；
- 而是需要用户点击“Assign/计算”之类的按钮，或由界面/API 显式触发后才执行。

这些字段必须显式写在 `config` 中，而不能只靠分析函数体推断，原因是：

- 依赖图校验要基于它们工作；
- 重复赋值检查要基于它们工作；
- 跨 runtime 的环检测也要基于它们工作。

## `fn` 中各个部分分别表示什么？

第二个参数 `fn` 是一个普通 JavaScript 函数，例如：

```js
function calculate_var_3({ var_1, var_2 }) {
  return {
    var_3: Math.round((var_1 + var_2) * 100) / 100,
  };
}
```

可以拆成以下几部分：

- `function`
  表示这里定义了一个函数。
- `calculate_var_3`
  是函数名。在当前设计里，函数名将作为该 client assigner 的 `id`，因此不再强制要求单独的 `id` 字段。
- `({ var_1, var_2 })`
  表示这个函数的输入本质上是一个对象，其中包含所有 `dependent_fields` 的值；这里采用了解构写法，等价于先接收一个 `dependent_fields` 对象，再从中取出 `var_1` 和 `var_2`。
- `return { ... }`
  表示把本次计算得到的输出字段值返回出去。这里返回的对象，直接就是 `assigned_fields` 的值对象，不需要再包一层 `assigned_fields: {...}`。

因此，这个函数可以被读成一句话：

- 读取 `var_1` 和 `var_2`
- 计算出 `var_3`
- 返回 `{ var_3: ... }` 作为赋值结果

## 输入和输出的 contract

client assigner 的核心 contract 可以概括为：

- 输入：`dependent_fields`
- 输出：`assigned_fields`

也就是说：

- 输入边界由 `dependent_fields` 明确声明；
- 输出边界由 `assigned_fields` 明确声明；
- 中间的计算逻辑可以简单，也可以复杂。

正因为输入输出边界是显式的，所以这套语法对用户、AI、校验器和运行时都更容易理解。

## `dependent_fields` / `assigned_fields` 的值类型如何决定？

client runtime 中看到的字段值类型，不是随意的 JavaScript 对象类型，而是**该字段在协议中的记录值表示**。

更具体地说：

- `dependent_fields` 中每个字段的值，来自前端 recorder 当前持有的记录数据；
- `assigned_fields` 返回时写回去的值，也必须遵循该字段对应的记录值表示；
- 这些值的结构，最终由协议字段自身的类型/schema 决定，而不是由 assigner 单独发明。

因此，client assigner 应当把输入输出理解为**面向 JSON 的记录值**，而不是 Python 对象或任意运行时实例。

在当前 client runtime 中，这通常意味着：

- 标量字段会表现为 `string`、`number`、`boolean`、`null` 这类 JSON 基本类型；
- 复合字段会表现为 `array` / `object` 这类 JSON 结构；
- 如果把整个 `var_table` 作为一个值参与计算，它通常会表现为一个 JSON 风格的表结构，例如 `array<object>`。

这也解释了为什么前端 client assigner 文档一直强调：

- 它消费的是 recorder 中已经存在的记录值；
- 它不直接接触 Python 类型、Pydantic 模型或后端运行时对象；
- 它的计算边界是有限的、可序列化的 JSON 风格数据结构。

简而言之：

- 字段的**名字**由 `dependent_fields` / `assigned_fields` 声明；
- 字段的**值类型**由协议字段自己的 schema / 记录值表示决定。

## 为什么推荐参数解构？

推荐写法：

```js
function calculate_var_3({ var_1, var_2 }) {
  return {
    var_3: var_1 + var_2,
  };
}
```

不推荐一直写成：

```js
function calculate_var_3(dependent_fields) {
  return {
    var_3: dependent_fields.var_1 + dependent_fields.var_2,
  };
}
```

原因不是第二种不能工作，而是第一种更清楚、更短，也更符合“输入就是 `dependent_fields` 对象，只是直接把字段拆出来使用”的心智模型。

## 多个输出字段怎么写？

如果 `assigned_fields` 中声明了多个字段，那么 `return` 的对象也应当一次性包含这些字段。例如：

```js
assigner(
  {
    mode: "auto",
    dependent_fields: ["mass_g", "volume_ml"],
    assigned_fields: ["density_g_ml", "concentration_g_ml"],
  },
  function calculate_solution_metrics({ mass_g, volume_ml }) {
    const density = mass_g / volume_ml;
    return {
      density_g_ml: density,
      concentration_g_ml: density,
    };
  }
);
```

这说明一个 assigner 完全可以是：

- 多个输入字段
- 多个输出字段

只要 `return` 对象的 key 和 `assigned_fields` 一一对应即可。

## 运行时限制

`runtime=client` 的目标是前端本地快速、确定地执行计算，因此应遵循这些原则：

- 保持确定性；
- 保持无副作用；
- 不依赖网络、环境变量、DOM、文件 I/O、随机数或定时器；
- 优先使用标准 JavaScript 能力，例如 `Math.round(...)`。

如果计算逻辑需要调用外部服务、依赖 Python 生态、或包含更复杂的权限/环境能力，建议继续使用 `assigner.py`。
