---
layout: home
hero:
  name: Airalogy
  text: 全球首个面向数据数字化与自动化的通用框架
  tagline: 面向数据与文档的标准化处理、结构化建模与自动化流程
features:
  - icon: 🧾
    title: 标准化语法
    details: 统一协议语法，便于解析、抽取与复用。
  - icon: 🧱
    title: 清晰的数据结构
    details: 结构化建模，保证类型安全与一致性。
  - icon: 🔌
    title: 实用 API
    details: 覆盖模型、转换与上传下载等核心能力。
  - icon: ⚙️
    title: 自动化流程
    details: 面向数据处理与研究工作流的自动化支持。
---

## 环境要求

Python `>=3.13`。

## 安装

```shell
pip install airalogy
```

## 开发

我们使用 `uv` 管理环境与构建，使用 `ruff` 进行 lint/format。

```shell
uv sync
uv run pytest
```

## 测试

```shell
uv run pytest
```

## License

Apache-2.0

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
