# Airalogy Markdown 工具

Airalogy 提供了一个用于处理 **Airalogy Markdown（AIMD）** 字符串的小工具，可以通过 `markdown` 别名导入：

```python
from airalogy import markdown as aimd
```

## 提取 Airalogy 图片 ID

使用 `aimd.get_airalogy_image_ids(content: str) -> list[str]` 自动扫描 AIMD 文本中的图片引用，并提取所有 Airalogy 文件 ID。支持的写法：

- 标准 Markdown 图片：`![alt](airalogy.id.file...png)`
- `fig` 代码块：`src:` 行包含 `airalogy.id.file...<ext>`

返回值为去重后的 ID 列表，按首次出现的顺序排列。

````python
from airalogy import markdown as aimd

content = """
![First](airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png)
```fig
id: fig_3
src: airalogy.id.file.ffffffff-1111-2222-3333-444444444444.tif
```
"""

ids = aimd.get_airalogy_image_ids(content)
# ["airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png",
#  "airalogy.id.file.ffffffff-1111-2222-3333-444444444444.tif"]
````
