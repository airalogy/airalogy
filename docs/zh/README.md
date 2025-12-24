# Airalogy

本项目要求 Python 版本 `>=3.13`

## 安装

```shell
pip install airalogy
```

## API 文档

- AIMD 工具：`docs/zh/apis/markdown.md`
- Types：`docs/zh/apis/types.md`
- Models：`docs/zh/apis/models.md`
- 下载/上传：`docs/zh/apis/download-upload.md`
- 文档转换：`docs/zh/apis/convert.md`

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
