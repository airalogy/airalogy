# Airalogy

本项目要求 Python 版本 `>=3.12`

## 安装

```shell
pip install airalogy
```

## 开发

开发过程中本项目使用到的工具：

- [pdm](https://pdm-project.org/en/stable/) 管理项目依赖
- [hatchling](https://github.com/pypa/hatch) 打包
- [ruff](https://github.com/astral-sh/ruff) 代码检查和格式化工具

安装 `pdm` (Linux/Mac)

```shell
curl -sSL https://pdm-project.org/install-pdm.py | python3 -
```

安装 `ruff` `hatchling`

```shell
pip install -U ruff hatchling
```

安装项目依赖

```shell
pdm sync
```

## 测试

```shell
pytest
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
