# `airalogy`

[English README](README.md)

[![PyPI version](https://img.shields.io/pypi/v/airalogy.svg)](https://pypi.org/project/airalogy/)
[![Checks](https://img.shields.io/github/actions/workflow/status/airalogy/airalogy/ci.yml)](https://github.com/airalogy/airalogy/actions)

**全球首个面向数据数字化与自动化的通用框架**

- [Airalogy 平台](https://airalogy.com)
- [英文文档](https://airalogy.github.io/airalogy/en/)
- [中文文档](https://airalogy.github.io/airalogy/zh/)
- [文档编写规范](docs/index.md)

## 核心特性

Airalogy 让你能够定义完全自定义的协议（**Airalogy Protocols**），用于描述数据如何被采集、校验和处理。

| 领域 | 说明 |
| - | - |
| **Airalogy Markdown (AIMD)** | 直接用 Markdown 定义丰富的数据字段，包括变量（`{{var}}`）、流程步骤（`{{step}}`）、检查点（`{{check}}`）等。 |
| **基于模型的数据校验** | 为每个协议绑定模型进行严格类型检查，支持 `datetime`、枚举、嵌套模型、列表等，也支持 Airalogy 内置类型，如 `UserName`、`CurrentTime`、`AiralogyMarkdown`、文件 ID 等。 |
| **Assigner 自动计算** | 通过声明式 `@assigner` 装饰器自动计算字段值。 |

## 环境要求

Python `>=3.13`

## 安装

```bash
pip install airalogy
```

维护者发布与 PyPI 自动发布流程见 [RELEASING.zh-CN.md](RELEASING.zh-CN.md)。

## 快速开始

### 使用一个带类型的 AIMD

**`protocol.aimd`**

```aimd
# Serum sample collection
Participant: {{var|subject_name: UserName, title="Participant name"}}
Collection time: {{var|collected_at: CurrentTime}}
Serum volume (mL): {{var|serum_volume: float, gt=0}}
Ice-bath time (min): {{var|ice_time: int = 0, ge=0}}
Sample photo: {{var|sample_photo: FileIdPNG, description="Upload collection photo"}}

{{step|collect}} Collect serum sample as per standard procedure.
{{step|verify_labels, 2}} Verify labels and IDs.
{{step|ice_hold, 2, duration="10m", timer="countdown"}} Immediately place sample on ice.

{{check|info_confirmed}} Confirm details and metadata.
```

- 使用 `airalogy check` 校验 AIMD，并直接投入使用。
- 如果需要显式模型文件，可以运行 `airalogy generate_model protocol.aimd -o model.py` 自动生成匹配这些类型的 Pydantic 模型。

### 扩展示例：增加 model 和 assigner

```text
protocol/
├─ protocol.aimd  # Airalogy Markdown
├─ model.py       # 可选：定义数据校验模型
└─ assigner.py    # 可选：定义自动计算逻辑
```

**`protocol.aimd`**

```aimd
# Reagent preparation
Solvent name: {{var|solvent_name}}
Target solution volume (L): {{var|target_solution_volume}}
Solute name: {{var|solute_name}}
Solute molar mass (g/mol): {{var|solute_molar_mass}}
Target molar concentration (mol/L): {{var|target_molar_concentration}}
Required solute mass (g): {{var|required_solute_mass}}
```

**`model.py`**

```python
from pydantic import BaseModel, Field

class VarModel(BaseModel):
    solvent_name: str
    target_solution_volume: float = Field(gt=0)
    solute_name: str
    solute_molar_mass: float = Field(gt=0)
    target_molar_concentration: float = Field(gt=0)
    required_solute_mass: float = Field(gt=0)
```

**`assigner.py`**

```python
from airalogy.assigner import AssignerResult, assigner


@assigner(
    assigned_fields=["required_solute_mass"],
    dependent_fields=[
        "target_solution_volume",
        "solute_molar_mass",
        "target_molar_concentration",
    ],
    mode="auto",
)
def calculate_required_solute_mass(dependent_fields: dict) -> AssignerResult:
    target_solution_volume = dependent_fields["target_solution_volume"]
    solute_molar_mass = dependent_fields["solute_molar_mass"]
    target_molar_concentration = dependent_fields["target_molar_concentration"]

    required_solute_mass = (
        target_solution_volume * target_molar_concentration * solute_molar_mass
    )

    return AssignerResult(
        assigned_fields={
            "required_solute_mass": required_solute_mass,
        },
    )
```

## 命令行接口

安装后可以直接使用 `airalogy` 命令：

```bash
$ airalogy --help
usage: airalogy [-h] [-v] {check,c,generate_model,gm,generate_assigner,ga,pack,unpack} ...

Airalogy CLI - Tools for Airalogy

positional arguments:
  {check,c,generate_model,gm,generate_assigner,ga,pack,unpack}
                        Available commands
    check (c)           Check AIMD syntax
    generate_model (gm)
                        Generate VarModel
    generate_assigner (ga)
                        Generate Assigner
    pack                Pack a protocol directory or record JSON files into a single-file archive
    unpack              Unpack an Airalogy archive

options:
  -h, --help            show this help message and exit
  -v, --version         show program's version number and exit
```

### 语法检查

```bash
# 检查默认 protocol.aimd
airalogy check

# 检查指定 AIMD 文件
airalogy check my_protocol.aimd

# 使用别名
airalogy c my_protocol.aimd
```

### 模型生成

```bash
# 从 protocol.aimd 生成 model.py
airalogy generate_model

# 自定义输出文件
airalogy generate_model my_protocol.aimd -o my_model.py

# 使用别名
airalogy gm my_protocol.aimd -o custom_model.py
```

### 提取 Assigner

```bash
# 从 protocol.aimd 生成 assigner.py，并移除内联 assigner 代码块
airalogy generate_assigner

# 使用别名
airalogy ga my_protocol.aimd -o assigner.py
```

### 单文件归档

Airalogy 使用统一的归档后缀 `.aira`。实际载荷类型存放在内部清单中的 `kind` 字段里，例如 `protocol` 或 `records`。

将协议目录打包成可分享的 `.aira` 文件：

```bash
airalogy pack ./my_protocol -o my_protocol.aira
```

将一个或多个记录 JSON 文件打包成 `.aira` 文件：

```bash
airalogy pack ./record.json ./record-history.json -o records.aira
```

如果希望记录包同时携带对应协议定义，也可以嵌入协议目录：

```bash
airalogy pack ./record.json -o record_bundle.aira --protocol-dir ./my_protocol
```

解包任意归档类型：

```bash
airalogy unpack ./my_protocol.aira -o ./extracted_protocol
airalogy unpack ./record_bundle.aira -o ./extracted_bundle
```

说明：

- 协议归档会保留原始协议目录结构，包括 `files/`。
- 记录归档接受包含单条记录对象或记录对象列表的 JSON 文件。
- 两种归档都使用 `.aira` 后缀；可以通过 `_airalogy_archive/manifest.json` 判断载荷是协议归档还是记录包。
- 协议打包默认排除 `.env` 和常见缓存产物，避免本地敏感信息被误打包。
- 记录归档目前只会打包 JSON 记录和可选嵌入协议目录，不会自动将远程 Airalogy 文件 ID 解析成原始文件字节。

## 文档转换（MarkItDown）

Airalogy 提供统一 API 将文档转换为 Markdown。

```bash
pip install "airalogy[markitdown]"
# 或（uv）
uv add "airalogy[markitdown]"
```

```python
from airalogy.convert import to_markdown
print(to_markdown("report.pdf", backend="markitdown").text)
```

参见文档：`docs/en/apis/convert.md` / `docs/zh/apis/convert.md`。

## 开发环境

我们使用 [uv](https://docs.astral.sh/uv/) 管理环境与构建，使用 [ruff](https://docs.astral.sh/ruff/) 进行 lint/format。

初始化项目环境：

```bash
uv sync
```

安装所有可选后端（extras）：

```bash
uv sync --all-extras
```

只安装指定 extra（例如 `markitdown`）：

```bash
uv sync --extra markitdown
```

## 测试

```bash
uv run pytest
```

## License

Apache 2.0

## 引用

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation}, 
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586}, 
}
```
