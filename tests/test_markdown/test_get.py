from airalogy import markdown as aimd


def test_get_airalogy_image_ids_handles_multiple_markdown_forms():
    content = """
Here is one image: ![First]( airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png )
```fig
id: fig_3
src: airalogy.id.file.ffffffff-1111-2222-3333-444444444444.tif
```

Duplicate reference ![dup](airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png)
"""
    ids = aimd.get_airalogy_image_ids(content)

    assert ids == [
        "airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png",
        "airalogy.id.file.ffffffff-1111-2222-3333-444444444444.tif",
    ]


def test_get_airalogy_image_ids_empty_when_no_images():
    assert aimd.get_airalogy_image_ids("No images here") == []


def test_get_airalogy_image_ids_ignores_non_airalogy_sources():
    content = """
![web](https://example.com/image.png)
![relative](/assets/figure.png)
![record](airalogy.id.record.123e4567-e89b-12d3-a456-426614174000.v.1)
![missing_ext](airalogy.id.file.123e4567-e89b-12d3-a456-426614174000)
![valid](airalogy.id.file.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg)
"""

    ids = aimd.get_airalogy_image_ids(content)

    assert ids == ["airalogy.id.file.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"]
