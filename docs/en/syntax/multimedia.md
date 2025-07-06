# Adding Multimedia Files to an Airalogy Protocol

You can embed images, PDFs, video, and audio directly in `protocol.aimd`.
All media files **must** live under the `/files/` directory so the platform can resolve their paths.

```txt
protocol/
├── protocol.aimd
├── files/
│   ├── images/
│   ├── videos/
│   ├── audios/
│   └── pdfs/
└── ...
```

Keeping assets in type-specific sub-folders is optional but highly recommended for organization.

## Referencing Media in AIMD

### Images

```aimd
![Image](files/images/example.png)
```

### Video

```aimd
<!-- Local MP4 -->
<video width="600" controls>
  <source src="files/videos/example.mp4" type="video/mp4">
</video>

<!-- Online video (e.g. YouTube) -->
<iframe
  width="560" height="315"
  src="https://www.youtube.com/embed/VIDEO_ID"
  frameborder="0"
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
></iframe>
```

### Audio

```aimd
<audio controls>
  <source src="files/audios/example.mp3" type="audio/mpeg">
</audio>
```

### PDF

```aimd
[Download PDF](files/pdfs/example.pdf)
```

> PDFs often span multiple pages, so they are exposed as a link.
> Users can open the document in a new tab or download it.

## Best Practices

| Tip | Why |
| - | - |
| Use descriptive file names | Easier to locate and update assets |
| Keep media sizes reasonable | Reduces protocol package size and load time |
| Prefer web-friendly formats (`png`, `mp4`, `mp3`) | Ensures broad browser support |

By organizing media under `/files/` and referencing them with relative paths, your protocol remains portable and renders consistently on the Airalogy platform.
