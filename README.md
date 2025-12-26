# `airalogy`

[![PyPI version](https://img.shields.io/pypi/v/airalogy.svg)](https://pypi.org/project/airalogy/)
[![Checks](https://img.shields.io/github/actions/workflow/status/airalogy/airalogy/ci.yml)](https://github.com/airalogy/airalogy/actions)

**The world's first universal framework for data digitization and automation**

- [Airalogy Platform](https://airalogy.com)
- [Docs (English)](https://airalogy.github.io/airalogy/en/)
- [Docs (Chinese)](https://airalogy.github.io/airalogy/zh/)
- [Good practices for documentation](docs/index.md)

## Key Features

Airalogy lets you create fully custom protocols (**Airalogy Protocols**) for defining how data is collected, validated, and processed.

| Area | Highlights |
| - | - |
| **Airalogy Markdown (AIMD)** | Define rich, custom data fields directly in Markdown—variables (`{{var}}`), procedural steps (`{{step}}`), checkpoints (`{{check}}`), and more. |
| **Model-based Data Validation** | Attach a model to every protocol for strict type checking—supports  datetime, enums, nested models, lists, etc.; and Airalogy-specific *built-in types* (`UserName`, `CurrentTime`, `AiralogyMarkdown`, file IDs, ...). |
| **Assigner for Auto-Computation** | Use the declarative `@assigner` decorator to compute field values automatically. |

## Requirements

Python ≥ 3.13

## Installation

```bash
pip install airalogy
```

## Quick Start

### Use one typed AIMD

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
{{step|ice_hold, 2}} Immediately place sample on ice.

{{check|info_confirmed}} Confirm details and metadata.
```

- Run `airalogy check` to validate the AIMD and use it directly.
- Need an explicit model file? `airalogy generate_model protocol.aimd -o model.py` auto-generates the Pydantic model that matches these types.

### Extended: add model and assigner

```text
protocol/
├─ protocol.aimd  # Airalogy Markdown
├─ model.py       # Optional: Define data validation model
└─ assigner.py    # Optional: Define auto-computation logic
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

## Command Line Interface

Airalogy provides a CLI tool for common operations. After installation, you can use the `airalogy` command:

```bash
$ airalogy --help
usage: airalogy [-h] [-v] {check,c,generate_model,gm,generate_assigner,ga} ...

Airalogy CLI - Tools for Airalogy

positional arguments:
  {check,c,generate_model,gm,generate_assigner,ga}
                        Available commands
    check (c)           Check AIMD syntax
    generate_model (gm)
                        Generate VarModel
    generate_assigner (ga)
                        Generate Assigner

options:
  -h, --help            show this help message and exit
  -v, --version         show program's version number and exit
```

### Syntax Checking

Check AIMD syntax:

```bash
# Check default protocol.aimd file
airalogy check

# Check specific AIMD file
airalogy check my_protocol.aimd

# Using alias
airalogy c my_protocol.aimd
```

### Model Generation

Generate VarModel from AIMD file:

```bash
# Generate model.py from protocol.aimd
airalogy generate_model

# Generate with custom output file
airalogy generate_model my_protocol.aimd -o my_model.py

# Using alias
airalogy gm my_protocol.aimd -o custom_model.py
```

### Assigner Extraction

Extract inline `assigner` code blocks into `assigner.py`:

```bash
# Generate assigner.py from protocol.aimd (and strip inline blocks)
airalogy generate_assigner

# Using alias
airalogy ga my_protocol.aimd -o assigner.py
```

## Document Conversion (MarkItDown)

Airalogy provides a unified API to convert documents into Markdown.

```bash
pip install "airalogy[markitdown]"
# or (uv)
uv add "airalogy[markitdown]"
```

```python
from airalogy.convert import to_markdown
print(to_markdown("report.pdf", backend="markitdown").text)
```

See docs: `docs/en/apis/convert.md` / `docs/zh/apis/convert.md`.

## Development Setup

We use [uv](https://docs.astral.sh/uv/) for environment management and build, [ruff](https://docs.astral.sh/ruff/) for lint/format.

setup project environment:

```bash
uv sync
```

Install all optional backends (extras) as well:

```bash
uv sync --all-extras
```

Or install a specific extra (example: `markitdown`):

```bash
uv sync --extra markitdown
```

## Testing

```bash
uv run pytest
```

## License

Apache 2.0

## Cite This Framework

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
