# Collector 语法与运行时

> 状态：第一阶段已实现。Python 和 npm parser 已支持 `collectors` 代码块与引用校验，`airalogy` 已提供 `Observation[T]` 和 `ObservationSeriesRef[T]` 数据模型，`@airalogy/aimd-recorder` 已支持宿主注入 provider 的 `snapshot`、手动启停 `polling`、当前 Record 授权和显式手工 fallback。`stream`、自动 step/record 生命周期和 `ObservationSeriesRef[T]` 文件写入属于后续路线。

## 目标

Collector（采集器）用于把外部服务、内网数据源或实验设备产生的数据写入 Airalogy Record。它应当覆盖以下典型场景：

- 用户点击“读取”，从电子温度计或电子秤获取一次数据。
- 按固定周期轮询 HTTP API 或内网仪器网关，直到用户停止、实验步骤结束或 Record 提交。
- 通过 WebSocket、SSE、MQTT、蓝牙、串口或设备 SDK 接收持续推送的数据。
- 在数据中保留采集时间、接收时间、来源、设备和质量状态，而不只保存一个脱离语境的数值。

Collector 初期只负责“读取数据”。向设备发送命令、改变温控器设定值、启动机器人等操作属于 Action / ResourceBridge 边界，需要独立的权限、确认和安全机制，不应混入 Collector。

## 概念边界

| 概念 | 责任 | 典型问题 |
| --- | --- | --- |
| Connector | 声明如何找到外部系统以及使用哪个 secret | 连接哪个网关？认证信息从哪个环境变量读取？ |
| Collector | 声明从 Connector 的哪个 channel 采集、采集模式和生命周期 | 读取哪台设备？单次、轮询还是流式？何时停止？ |
| `var` | 声明采集结果在 Record 中的字段名称、类型和业务语义 | 数据最终写到哪个字段？应如何校验？ |
| Assigner | 根据已有字段计算派生值 | 如何由温度序列计算平均值？ |

因此整体关系是：

```text
Connector -> Collector -> var -> optional Assigner
```

Connector 和 Collector 都是 Protocol metadata。Parser 负责解析和校验，不会在解析 AIMD 时访问网络、打开设备或启动后台任务。

## 最小完整示例

下面的示例从内网仪器网关每 5 秒读取一次培养箱温度，由用户手动开始和停止：

````aimd
```connectors
lab_sensor_gateway:
  kind: data_source
  descriptor: https://lab.example.com/airalogy/sensors.yaml
  auth:
    token_env: LAB_SENSOR_TOKEN
```

```collectors
incubator_temperature:
  connector: lab_sensor_gateway
  channel: incubator-01.temperature
  mode: polling
  interval: 5s
  lifecycle:
    start: manual
    stop: manual
```

# 培养箱温度记录

{{var|temperature_log: list[Observation[float]] | None, title="培养箱温度", unit="Cel", collector="incubator_temperature"}}
````

`.env.example` 只声明运行时需要的环境变量：

```bash
LAB_SENSOR_TOKEN=
```

真实 token 由 `.env` 或部署环境的 secret manager 提供，不应写入 AIMD、connector descriptor 或公开 `.aira` 包。

## `connectors` 扩展

Collector 复用现有 `connectors` 代码块，不在每个 Collector 里重复声明 URL 和认证信息。数据采集来源使用新的 `kind: data_source`：

```yaml
lab_sensor_gateway:
  kind: data_source
  descriptor: https://lab.example.com/airalogy/sensors.yaml
  auth:
    token_env: LAB_SENSOR_TOKEN
```

`descriptor` 可以是 HTTP(S) URL，也可以是 `.aira` 包内的相对路径。如果宿主应用已经按 connector id 注入运行时 provider，`descriptor` 可以省略；此时这个 Protocol 只能在提供对应 provider 的运行环境中执行采集，但仍然可以在其他环境中解析、查看和手动填写非 Collector 字段。

Connector 只负责“如何连接”，不应在这里写 `interval`、`start`、`stop` 或目标字段；这些属于 Collector 或 `var`。

### Descriptor 最小外壳

初始版本只标准化 descriptor 的最小外壳，不试图用一套声明式语法描述 HTTP、WebSocket、蓝牙、串口、MQTT 和厂商 SDK 的所有细节：

```yaml
kind: data_source
provider: http_json
capabilities:
  - snapshot
config:
  endpoint: https://lab.example.com/api/temperature
```

标准字段负责跨宿主的发现和能力协商：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `kind` | 是 | 初始值为 `data_source`。 |
| `provider` | 是 | 运行时 Provider 类型的稳定标识符，例如 `http_json`。 |
| `capabilities` | 否 | Descriptor 声明的能力上限，例如 `snapshot` 或 `stream`；最终以运行时 Provider 实际报告为准。 |
| `config` | 否 | 由对应 Provider 解释的 JSON/YAML 对象；AIMD parser 只保留结构，不解释内部传输语义。 |

Descriptor 不是可执行代码。它不得携带 JavaScript、shell 命令、动态模块 URL 或内联 secret。宿主只能将 descriptor 交给已安装且受信任的 Provider；找不到 `provider` 对应实现时，Protocol 仍可以解析，但 Collector 必须显示当前环境不支持该数据源。

## `collectors` 代码块

Collector 使用 fenced `collectors` 代码块，块内为 YAML。Collector id 直接位于代码块顶层，不需要额外增加顶层 `collectors:` 包装或必填 `version`：

````aimd
```collectors
room_temperature:
  connector: lab_sensor_gateway
  channel: room-201.temperature
  mode: snapshot
```
````

Collector 字段如下：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `connector` | 是 | 引用同一 Protocol 内 `connectors` 代码块中的 connector id。 |
| `channel` | 条件必填 | 指定 provider 的稳定数据通道 id，例如 `incubator-01.temperature`。Connector 有默认 channel 或 provider 只提供一个 channel 时可以省略；存在多个可选 channel 且没有默认值时必须填写。 |
| `mode` | 否 | `snapshot`、`polling` 或 `stream`；省略时默认为 `snapshot`。 |
| `interval` | 条件必填 | 仅 `polling` 模式使用，采用 `250ms`、`5s`、`1min` 等时长字符串。 |
| `lifecycle` | 否 | 声明开始和停止条件。省略时由用户手动控制；`snapshot` 获取到一条数据后自动完成。 |
| `manual_fallback` | 否 | Collector 不可用时是否允许用户明确切换为手工录入；省略时默认为 `false`。 |
| `title` | 否 | 供 Recorder 显示的 Collector 名称；省略时使用 Collector id。 |

`channel` 是 provider 的不透明标识符。Protocol 可以稳定地引用它，但不要假设它一定是 URL、MQTT topic 或物理设备端口；具体传输方式由 connector descriptor 或宿主 provider 决定。

当 Collector 省略 `channel` 时，runtime 按以下顺序解析：

1. 使用 connector descriptor 或宿主 provider 明确声明的默认 channel。
2. 如果 provider 只暴露一个 channel，使用该唯一 channel。
3. 如果存在多个 channel 且没有默认值，报告配置错误并要求 Protocol 作者显式填写 `channel`。

Runtime 不会自动虚构一个名为 `default` 的 channel。缺省值必须来自 provider 可验证的能力声明，避免在无报错的情况下读取错误数据源。

因此，只提供一个温度通道的专用电子温度计可以使用更简洁的写法：

```yaml
room_temperature:
  connector: dedicated_thermometer
  mode: snapshot
```

## 手工 fallback

绑定 Collector 通常表示“这个字段应来自指定设备或数据源”，因此 Collector 不可用时不能默认退化成普通输入框。Protocol 作者需要显式开启手工 fallback：

```yaml
room_temperature:
  connector: dedicated_thermometer
  mode: snapshot
  manual_fallback: true
```

规则如下：

- `manual_fallback` 省略或为 `false` 时，Recorder 只显示连接错误、重试和故障信息，不显示手工值输入框。
- `manual_fallback: true` 时，Recorder 可以显示“切换为手工录入”，但不能在 Collector 失败后静默切换。
- 用户启用手工 fallback 时必须填写原因，例如“温度计无法连接”。
- Collector 恢复后不能自动覆盖已保存的手工 Observation。用户可以显式重新读取；新读数是替换标量还是追加到列表，仍由目标字段类型决定。
- 手工录入仍然保存为 `Observation[T]`，不把字段类型退化为裸值。

## 采集模式

### `snapshot`

`snapshot` 每次运行只获取一条 Observation。Recorder 应在字段附近显示“读取”按钮。

```yaml
room_temperature:
  connector: lab_sensor_gateway
  channel: room-201.temperature
  mode: snapshot
```

当目标类型是 `Observation[T]` 时，新读数替换当前值前应给用户清晰反馈；当目标类型是 `list[Observation[T]]` 时，每次读数追加一项。

### `polling`

`polling` 由 Airalogy 运行时按 `interval` 主动读取。该模式必须提供 `interval`，目标字段应为 `list[Observation[T]]`：

```yaml
incubator_temperature:
  connector: lab_sensor_gateway
  channel: incubator-01.temperature
  mode: polling
  interval: 5s
  lifecycle:
    start: manual
    stop: manual
```

Provider 可以根据设备限制拒绝过短的轮询间隔。Parser 只校验时长格式，不保证某个设备能够按该频率工作。

### `stream`

`stream` 由 provider 持续推送 Observation，不需要 `interval`：

```yaml
bioreactor_temperature:
  connector: lab_sensor_gateway
  channel: bioreactor-07.temperature
  mode: stream
  lifecycle:
    start: manual
    stop: manual
```

WebSocket、SSE、MQTT、Web Bluetooth、Web Serial 或仪器 SDK 都可以由不同 provider 实现。AIMD 语法不应为每种传输方式增加一组字段。

## 生命周期

默认生命周期是手动开始和手动停止：

```yaml
lifecycle:
  start: manual
  stop: manual
```

持续采集可以绑定到某个 `step` 的开始和完成事件：

```yaml
lifecycle:
  start:
    event: step_start
    step: incubation
  stop:
    event: step_complete
    step: incubation
```

也可以与整条 Record 的运行周期绑定：

```yaml
lifecycle:
  start: record_start
  stop: record_complete
```

建议的初始事件集合是：

| 阶段 | 事件 | 语义 |
| --- | --- | --- |
| start | `manual` | 由用户点击“读取”或“开始采集”。 |
| start | `record_start` | Record 运行开始时请求启动。 |
| start | `step_start` | 指定 step 进入执行状态时请求启动。 |
| stop | `manual` | 由用户点击“停止”。 |
| stop | `step_complete` | 指定 step 完成时停止。 |
| stop | `record_complete` | Record 提交或运行完成前停止。 |

### Step 生命周期

`step_start` 和 `step_complete` 必须来自明确的 Step 状态转换，不得通过计时器或勾选框状态隐式推测。绑定这类事件的 Step 使用以下状态机：

```text
pending -> running -> completed
```

Recorder 应提供对应的明确操作：

- `pending` 状态显示“开始步骤”；操作成功后转为 `running` 并触发一次 `step_start`。
- `running` 状态显示“完成步骤”；操作成功后停止相关 Collector 和计时器，转为 `completed` 并触发一次 `step_complete`。
- 重新打开已完成步骤属于独立的修订操作，不应因页面重新渲染、Record 重新加载或简单取消勾选而自动重放 `step_start`。

Step 生命周期、Timer 和 Check 是三个独立概念：

- Timer 只负责记录时长。开始步骤可以同时启动已启用的 Timer，但暂停或继续 Timer 不改变 Step 的 `running` 状态，也不重复触发 `step_start`。
- Check 只表示用户对某个检查项的勾选或确认，不在全局语义上等同于 Step 完成，也不直接触发 `step_complete`。

当 Collector 引用某个 Step 的 `step_start` 或 `step_complete` 时，Recorder 应为该 Step 启用生命周期控件；未被引用的现有 Step 保持原有交互，避免给无采集或审计需求的 Protocol 增加额外操作。Runtime 应持久化 Step 状态和独立的开始、完成时间；Timer 的开始时间和累计时长仍使用独立字段。

`record_start` 和 `step_start` 不意味着打开页面后可以无提示地访问网络或设备。交互式 Recorder 首次使用某个 connector 时应明确请求用户授权；只有受信任的自动化运行时才可以根据预先配置的权限自动启动。

Record 完成时不应留下无归属的前端采集任务。如果任务需要跨越页面或 Record 长期运行，应转交给有持久化能力的本地 agent 或服务端 runtime。

## 授权模型

Collector 使用“首次明确授权，当前 Record 内复用”的默认模型。每次 `step_start` 都重复弹窗会打断实验流程，但 Protocol 也不能因为声明了自动生命周期就永久获得设备或网络权限。

交互式 Recorder 建议提供以下选项：

1. 仅本次允许。
2. 当前 Record 期间允许，并作为默认建议选项。
3. 记住此 Protocol 版本的授权，由用户显式选择，在后续阶段实现。
4. 拒绝。

授权至少绑定以下边界：

```text
user
Protocol id + version or content hash
Connector id
connector descriptor or provider identity
channel or device scope
capability scope
```

不同能力分开授权，不能因为用户曾经允许一次单次读取，就自动获得持续或后台采集权限：

| 能力 | 说明 |
| --- | --- |
| `read_once` | 执行一次 `snapshot` 读取。 |
| `continuous_read` | 启动 `polling` 或 `stream` 持续采集。 |
| `background_read` | 页面关闭或交互会话结束后由 agent / service runtime 继续采集。 |

当 `record_start` 或 `step_start` 触发时，runtime 先检查是否存在完整覆盖当前范围的有效授权。存在授权时可以自动开始；不存在时进入 `waiting_for_permission`，不得在用户确认前访问网络或设备。用户允许“当前 Record”后，该 Record 后续使用相同 Connector、channel 和能力范围的 step 不再重复确认。

Protocol 版本、内容 hash、Connector URL、descriptor、provider 身份、channel / 设备范围或所需能力发生变化时，不再复用旧授权。Web Bluetooth、Web Serial、USB 等浏览器能力仍然遵守浏览器原生授权流程，Airalogy 授权不能绕过它们。

AIMD 只能声明 Collector 需要的能力，不允许声明“自动授权”或“永久记住”。Recorder 必须持续显示正在采集的状态，并允许用户随时停止采集和撤销可持久授权。

## 字段绑定

`var` 通过 `collector="..."` metadata 引用 Collector：

```aimd
室内温度：{{var|room_temperature: Observation[float] | None, unit="Cel", collector="room_temperature"}}
```

持续采集使用 Observation 列表：

```aimd
培养箱温度：{{var|temperature_log: list[Observation[float]] | None, unit="Cel", collector="incubator_temperature"}}
```

字段绑定使用以下约束：

- 一个字段最多绑定一个 Collector。
- 一个 Collector 在同一 Protocol 内最多作为一个字段的直接数据来源。如果需要复用结果，可通过 Assigner 派生到其他字段。
- 绑定 `collector="..."` 的字段必须使用 `Observation[T]`、`list[Observation[T]]` 或 `ObservationSeriesRef[T]`，不允许 Collector 直接写入 `float`、`int`、`str` 等裸值。
- `snapshot` 可以写入 `Observation[T]` 或 `list[Observation[T]]`。
- `polling` 和 `stream` 可以写入 `list[Observation[T]]` 或 `ObservationSeriesRef[T]`，不允许反复覆写普通标量而丢失历史。`ObservationSeriesRef[T]` 的文件化存储属于第二阶段实现。
- `| None` 表示在还没有成功采集时字段可以为空，不会改变 Collector 的启停规则。
- Collector id 必须存在，其 connector id 也必须存在且 `kind` 与数据采集兼容。

初始版本先只覆盖普通 `var`。`var_table` subvar、`step` 和 `check` 的 Collector 绑定可以在运行模型稳定后扩展。

## `Observation[T]` 数据结构

Collector 不应只保存 `23.4` 这样的裸值。Airalogy 使用通用内置类型 `Observation[T]`，而不为温度计、电子秤、pH 计等每种设备创建专用类型。

`Observation[T]` 不是 Collector 的专有类型。Collector 是有连接、可选 channel、采集模式和生命周期的运行组件，`Observation[T]` 是已经产生并保存在 Record 中的观测值。Collector 可以产生 Observation，但 Observation 也可以来自人工观察、文件导入或其他受信任的数据源。因此字段类型不使用 `Collector[T]`；`list[Collector[float]]` 会被误解为“采集器列表”，而不是“温度观测列表”。

```text
Collector -> Observation[T]
采集器    -> 观测记录
```

一条标准 Observation 的建议保存结构如下：

```json
{
  "value": 23.4,
  "observed_at": "2026-07-19T20:30:05+08:00",
  "received_at": "2026-07-19T20:30:06+08:00",
  "source": {
    "kind": "collector",
    "connector": "lab_sensor_gateway",
    "collector": "incubator_temperature",
    "device_id": "incubator-01"
  },
  "unit": "Cel",
  "quality": "ok",
  "sequence": 42,
  "metadata": {
    "firmware": "2.3.1"
  }
}
```

建议字段如下：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `value` | 是 | 真正写入的 `T` 类型数据。 |
| `observed_at` | 是 | 观测在现实世界发生的时间。设备未提供时，runtime 使用接收时间填充。 |
| `received_at` | 是 | Airalogy runtime 收到该数据的时间。 |
| `source` | 是 | 结构化来源对象，使用 `kind` 区分 `collector`、`manual`、`import` 等来源，其他字段按 `kind` 条件校验。 |
| `unit` | 否 | 实际数据的单位。如果 `var` 声明了预期单位，runtime 应校验或换算后再写入。 |
| `quality` | 否 | 数据源或 runtime 提供的质量状态，初始设计保留为可扩展字符串。 |
| `sequence` | 否 | 数据源内的递增序号，用于发现丢包或重复数据。 |
| `metadata` | 否 | JSON 对象，保存与该次观测直接相关的少量扩展信息。 |

`source.kind: collector` 时，`connector` 和 `collector` 必填，`device_id` 可选。Provider 返回的原始数据不必须已经使用这些字段名，也可以只返回 `23.4` 这样的裸值。Runtime 必须根据 Collector 上下文补全观测时间、接收时间和结构化 `source`，在写入 Record 前将它归一化为 `Observation[T]`。Recorder 可以只显示 `value` 和必要的来源摘要，不需要让用户直接编辑整个 Observation JSON。

手工 fallback 生成的 Observation 必须使用 `source.kind: manual`，保留原本绑定的 Collector id，并记录操作者和原因：

```json
{
  "value": 23.5,
  "observed_at": "2026-07-19T20:32:00+08:00",
  "received_at": "2026-07-19T20:32:00+08:00",
  "source": {
    "kind": "manual",
    "collector": "incubator_temperature",
    "actor_id": "user-123",
    "reason": "Thermometer connection failed"
  },
  "unit": "Cel"
}
```

`source.kind: manual` 时，`collector` 和 `reason` 必填；宿主能够识别当前用户时 `actor_id` 也必填。这里不填写 `connector` 和 `device_id`，因为数据并非由对应设备产生。`quality` 仍然用于表达数据质量，不用 `quality: manual` 代替来源 provenance。

## 写入和数据保留规则

- Collector 获取的 Observation 必须先通过目标 `var` 的类型和字段约束，然后才能写入 Record。
- `Observation[T]` 目标保存最新一次成功读数；重新读取时不应在无反馈的情况下覆盖已有值。
- `list[Observation[T]]` 目标默认追加新数据。停止后重新启动采集时继续追加，不默认清空旧数据。
- Collector 来源和手工 fallback 来源的 Observation 可以出现在同一列表中，每一项必须依靠 `source.kind` 自包含地说明来源。
- 采集进行期间不应允许用户修改、重排或删除已采集的 Observation。停止采集后如果允许修订，必须保留修订记录。
- 无法通过类型、单位或字段约束校验的 Observation 不应静默写入，runtime 应显示错误并保留采集任务日志。
- Record 提交时必须等待 Collector 安全停止，或明确拒绝提交并要求用户先处理正在运行的采集任务。

## 高频和大数据量采集

`list[Observation[T]]` 适合低频、中等数量的观测数据，例如每 5 秒采集一次、持续 30 分钟。它不适合高频波形、图像帧或持续数天的传感器数据。

数据保存为普通 Observation 列表还是文件化 SeriesRef，由 Protocol 作者通过目标字段类型明确决定，不使用运行时隐式阈值：

```aimd
{{var|temperature_samples: list[Observation[float]] | None, collector="incubator_temperature"}}
{{var|temperature_series: ObservationSeriesRef[float] | None, collector="incubator_temperature"}}
```

Provider 负责声明自己支持的输出能力，宿主可以设置内存、数据点数量或文件大小的安全上限。当 Protocol 选择的类型与 provider 能力或宿主限制冲突时，runtime 应在采集前报错或给出可操作警告，不能在采集过程中把 `list[Observation[T]]` 静默改成 `ObservationSeriesRef[T]`，否则同一 Protocol 会产生不同 schema 的 Record。

高频数据应将数据流保存为 CSV、Parquet、Arrow 或设备原生文件，Record 字段使用 `ObservationSeriesRef[T]` 保存文件引用、时间范围、数据点数量、校验和来源摘要：

```aimd
{{var|temperature_series: ObservationSeriesRef[float] | None, unit="Cel", collector="incubator_temperature"}}
```

Collector provider 可以使用以下三种交付方式，runtime 最终都将它们归一化为 `ObservationSeriesRef[T]`：

1. **边采集边生成文件**：runtime 持续把数据块写入临时文件，采集停止后关闭文件、计算 hash、上传或打包，然后写入文件引用。
2. **设备完成后返回文件**：仪器或网关在一次测量结束后返回 CSV、Parquet 或专有格式文件，runtime 将其写入 Airalogy 文件系统或 `.aira` blob 层。
3. **外部系统返回稳定文件 id**：数据仍保存在仪器网关、LIMS 或对象存储中，provider 返回可由 connector 长期解析的唯一标识符。Runtime 将其归一化为稳定 `source_uri`，而不保存来源不明的裸 id。

`ObservationSeriesRef[T]` 复用现有 `.aira` 文件载荷机制。`file_id`、`source_uri` 和 `blob_id` 至少需要提供一种，也可以同时存在：

- `file_id`：文件已经进入 Airalogy 文件系统。
- `source_uri`：文件仍在外部系统中，需要通过 connector 解析。
- `blob_id`：文件字节已进入 `.aira` 的 content-addressed blob 层，可离线读取。

建议的保存结构如下：

```json
{
  "file_id": "airalogy.id.file.xxxxx.parquet",
  "source_uri": "connector://lab_sensor_gateway/measurement-run-20260719-001",
  "blob_id": "sha256:abcdef...",
  "filename": "incubator-temperature.parquet",
  "mime_type": "application/vnd.apache.parquet",
  "size": 123456,
  "sha256": "abcdef...",
  "format": "parquet",
  "started_at": "2026-07-19T20:00:00+08:00",
  "ended_at": "2026-07-19T20:30:00+08:00",
  "point_count": 360,
  "source": {
    "kind": "collector",
    "connector": "lab_sensor_gateway",
    "collector": "incubator_temperature",
    "device_id": "incubator-01"
  },
  "unit": "Cel"
}
```

短期 signed URL 不能作为 Record 的唯一长期文件引用。Runtime 可以用 signed URL 下载文件，但应在完成采集时转换为稳定 `file_id`、`blob_id` 或可长期解析的 `source_uri`。

初始 Collector provider 协议应预留两类归一化输出，避免以后为文件化数据破坏接口：

```text
Observation[T]           单条或低频数据
ObservationSeriesRef[T]  文件化的高频或大体量数据
```

`ObservationSeriesRef[T]` 的完整存储和上传实现仍然可以放在第二阶段，但第一阶段的 provider 类型与任务完成协议应为它保留扩展位置。

## 运行时边界

AIMD parser 只输出归一化后的 connector、Collector 和字段绑定 metadata。初始版本就标准化最小 DataSource Provider contract，但以宿主注入受信任 Provider 作为首个执行机制。不同宿主可以使用不同技术连接数据源，但对 Recorder 暴露相同的能力、输入、输出、取消和错误语义。

以下 TypeScript 仅表达跨语言 contract，并不要求 Python 或其他 runtime 使用 TypeScript 实现：

```ts
type DataSourceMode = "snapshot" | "polling" | "stream"

interface DataSourceChannel {
  id: string
  label?: string
}

interface DataSourceRequest {
  connector: string
  channel?: string
  config?: Record<string, unknown>
}

interface DataSourceCapabilities {
  modes: DataSourceMode[]
  channels?: DataSourceChannel[]
  defaultChannel?: string
}

interface ProviderObservationInput<T> {
  value: T
  observed_at?: string
  unit?: string
  quality?: string
  sequence?: number
  metadata?: Record<string, unknown>
  device_id?: string
}

interface DataSourceProvider {
  describe(): Promise<DataSourceCapabilities>
  listChannels?(): Promise<DataSourceChannel[]>
  read<T>(request: DataSourceRequest, signal: AbortSignal): Promise<T | ProviderObservationInput<T>>
  subscribe?<T>(request: DataSourceRequest, signal: AbortSignal): AsyncIterable<T | ProviderObservationInput<T>>
}
```

Contract 使用以下规则：

- `snapshot` 调用一次 `read()`。
- `polling` 由 Airalogy runtime 按 Collector `interval` 重复调用 `read()`，Provider 不需要自己创建轮询计时器。
- `stream` 要求 Provider 实现 `subscribe()`。
- 读取和订阅都必须接受取消信号；收到取消后必须释放网络连接、计时器、蓝牙、串口或设备 SDK 资源。
- Provider 可以返回裸值或部分 Observation。Runtime 负责补全 `received_at`、结构化 `source` 和缺失的 `observed_at`，并在写入 Record 前执行目标字段校验。
- Provider 必须返回可分类的连接、认证、权限、超时、取消、不支持、数据校验和设备错误，不得把失败伪装成空值。

宿主可以按 connector id 直接注入 Provider，也可以为已安装的 descriptor `provider` 类型注册工厂。前者是初始必须实现的路径，后者为可移植 descriptor 预留稳定边界。Provider 的实际能力必须是 descriptor 声明能力和宿主授权能力的交集，不得因 descriptor 声明了某项能力就越过宿主限制。

Collector runtime 应根据 Provider 调用过程暴露可观测运行状态，例如 `idle`、`connecting`、`collecting`、`stopping`、`completed` 和 `error`。这些状态属于 Collector runtime，不写入 descriptor。

纯浏览器 Recorder 可以处理宿主允许的 HTTP、WebSocket、SSE、Web Bluetooth 和 Web Serial 场景。需要访问内网、MQTT、厂商 SDK、系统串口，或需要在浏览器关闭后继续运行的任务，应由 Airalogy Engine、本地 edge agent 或受控服务端 provider 执行。

## Recorder 交互建议

Collector 字段不应只显示一个普通文本输入框。Recorder 应根据模式提供：

- `snapshot`：“读取”按钮、当前读数、观测时间、设备和错误状态。
- `polling` / `stream`：“开始采集”和“停止”按钮、运行状态、持续时间、数据点数量、最新读数和最后接收时间。
- 无 provider 时：清晰显示“当前环境未连接采集器”，但不影响 Protocol 的解析和静态阅读。只有 Collector 声明 `manual_fallback: true` 时才显示“切换为手工录入”。
- 断线或校验失败时：保留已采集数据，显示“重试”或“停止”，不自动清空字段。

Collector 运行时应使用稳定状态显示，不使用持续闪烁。只有新数据到达时可以短暂 pulse，并尊重 `prefers-reduced-motion`。

## 安全规则

- AIMD、connector descriptor 和 Collector 中都不允许内联 token、password、API key 或 client secret。
- Protocol 声明“想采集什么”，不自动获得访问内网、蓝牙、串口或本地设备的权限。
- 宿主可以使用域名、connector id、设备 id、Protocol id 和用户角色建立 allowlist。
- 用户或运行时必须能够随时停止持续采集。
- Collector 是只读数据通道。如果 provider 同时支持设备控制，其写操作必须通过独立 Action 能力暴露。

## 实现状态与后续路线

当前已实现：

1. Parser 解析 `collectors` 代码块和 `collector="..."` 字段 metadata，并校验引用关系。
2. Python `airalogy` 提供 `Observation[T]` 泛型模型和 Pydantic 校验。
3. `@airalogy/aimd-core` 输出语言无关的 Collector metadata。
4. `@airalogy/aimd-recorder` 提供标准 DataSource Provider contract 和宿主按 connector id 注入 Provider 的接口，parser 同时解析并保留最小 descriptor 外壳。
5. Recorder 先支持 `snapshot`、手动启停的 `polling`、当前 Record 范围授权和显式开启的手工 fallback，完成状态、错误、来源、停止和 Record 写入闭环。

后续路线：

1. `stream` provider。
2. `record_start` / `record_complete` 自动生命周期，以及独立 Step 状态、“开始步骤”/“完成步骤”控件和 `step_start` / `step_complete` 事件。
3. Protocol 版本级可撤销持久授权。
4. 后台 edge agent 和跨页面采集任务。
5. `ObservationSeriesRef[T]` 大数据量存储。
