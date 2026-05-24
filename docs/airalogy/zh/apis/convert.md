# 文档转换（MarkItDown 后端）

Airalogy 提供了一个统一的文档转换 API，可通过可插拔后端把各种输入转换为 Markdown。

目前支持的后端：

- `markitdown`（可选依赖）

## 安装

通过安装 extra 来启用 `markitdown` 后端：

```bash
# pip
pip install "airalogy[markitdown]"

# uv（安装到当前环境）
uv pip install "airalogy[markitdown]"

# uv（添加到项目依赖）
uv add "airalogy[markitdown]"
```

备注：MarkItDown 会按文件类型拆分可选依赖（例如 `pdf`、`docx`）。`airalogy[markitdown]` 会安装 PDF/DOCX 转换所需依赖。

## API

导入：

```python
from airalogy.convert import to_markdown
```

转换本地文件：

```python
result = to_markdown("report.pdf", backend="markitdown")
print(result.text)
```

转换 bytes（建议同时提供 `filename`，便于后端推断文件类型）：

```python
result = to_markdown(file_bytes, filename="report.pdf", backend="markitdown")
print(result.text)
```

转换 Airalogy 平台托管的文件 ID（会先通过 `Airalogy` 客户端下载）：

```python
from airalogy import Airalogy

client = Airalogy()
result = to_markdown(
    "airalogy.id.file.<UUID>.pdf",
    backend="markitdown",
    client=client,
)
print(result.text)
```

## 返回值

`to_markdown(...)` 返回一个 `MarkdownResult`：

- `text`：转换后的 Markdown 内容
- `backend`：使用的后端名称（例如 `"markitdown"`）
- `source_filename`：尽力推断的文件名（若可用）
- `warnings`：非致命警告信息（可能为空）
