# AIMD Markdown utilities

Airalogy ships a small helper for working with **Airalogy Markdown (AIMD)** strings. Import it via the `markdown` alias:

```python
from airalogy import markdown as aimd
```

## Extract Airalogy image IDs

Use `aimd.get_airalogy_image_ids(content: str) -> list[str]` to pull out every Airalogy File ID that appears as an image source inside an AIMD document. Supported forms:

- Standard Markdown image: `![alt](airalogy.id.file...png)`
- `fig` blocks: a `src:` line containing `airalogy.id.file...<ext>`

The function returns **unique** IDs, in the order of first appearance.

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
