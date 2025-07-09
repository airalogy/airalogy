# `airalogy`

[![PyPI version](https://img.shields.io/pypi/v/airalogy.svg)](https://pypi.org/project/airalogy/)

**The world's first universal framework for standardized data digitization**  

- [Airalogy Platform](https://airalogy.com)
- [Docs (English)](docs/en/README.md)
- [Docs (Chinese)](docs/zh/README.md)
- [Good practices for documentation](docs/README.md)

## Key Features

Airalogy lets you create fully custom protocols (**Airalogy Protocols**) for defining how data is collected, validated, and processed.

| Area | Highlights |
| - | - |
| **Airalogy Markdown** | Define rich, custom data fields directly in Markdown—variables (`{{var}}`), procedural steps (`{{step}}`), checkpoints (`{{check}}`), and more. |
| **Model-based Data Validation** | Attach a model to every protocol for strict type checking—supports  datetime, enums, nested models, lists, etc.; and Airalogy-specific *built-in types* (`UserName`, `CurrentTime`, `AiralogyMarkdown`, file IDs, ...). |
| **Assigner for Auto-Computation** | Use the declarative `@assigner` decorator to compute field values automatically. |

## Requirements

Python ≥ 3.12

## Installation

```bash
pip install airalogy
```

## Quick Start

**Create a Protocol**

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
from airalogy.assigner import AssignerBase, AssignerResult, assigner


class Assigner(AssignerBase):
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

## Development Setup

We use [pdm](https://pdm-project.org/en/stable/) for dependency management, [ruff](https://github.com/astral-sh/ruff) for lint/format, and [hatchling](https://github.com/pypa/hatch) for builds.

## Testing

```bash
pytest
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
