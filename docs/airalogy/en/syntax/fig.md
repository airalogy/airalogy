# Inserting Figures in Airalogy Markdown

Use `fig` for static images where figure numbering, titles, legends, and <code v-pre>{{ref_fig|...}}</code> references matter. Even when the image is a local file packaged inside `.aira`, `fig` remains the recommended form. For video, audio, PDFs, or lesson media that needs player interactions, use [`media`](./multimedia.md).

## Insert Figures

In AIMD, you can insert images by using a `fig` code block. For example:

````aimd
```fig
id: fig_1
src: files/images/example.png
title: Example Figure
legend: This is an example figure legend.
```
````

`id` and `src` are required. The `id` must be unique within the document and acts as the figure's stable identity for references, numbering, navigation, deduplication, editor positioning, and later structured processing. `title` and `legend` are optional but recommended. The example above uses a local file `files/images/example.png` as the image source. You can also use an online URL as the source, for example:

````aimd
```fig
id: fig_2
src: https://example.com/images/online_image.png
title: Online Image Example
legend: This is an example of an image sourced from a URL.
```
````

Or use an Airalogy file ID as the source, for example:

````aimd
```fig
id: fig_3
src: airalogy.id.file.12345678-1234-1234-1234-1234567890ab.png
title: Airalogy File Image Example
legend: This is an example of an image referenced by an Airalogy file ID.
```
````

The `fig` code block body is a key-value mapping compatible with YAML. If `legend` contains multiple lines, use `|`:

````aimd
```fig
id: fig_2
src: files/images/multi-line-example.png
title: Multi-line Figure Example   
legend: |
  This is a figure legend that spans multiple lines.
  Second line.
  Third line.
```
````

## Figure IDs During Authoring

Official editors generate a readable `id` when a figure is inserted, usually from its `src` filename. For example, `src: images/lab-team.jpeg` produces `id: lab_team`. Generated IDs contain letters, numbers, and underscores, avoid document-level conflicts, are written into the AIMD source, and remain editable.

Draft editing remains permissive. An unfinished `fig` block is not rewritten by automatic draft saving. Once a closed `fig` block has `src` but no non-empty `id`, the source editor reports a diagnostic and offers a generate-ID quick fix. The official editor can still show that image in draft preview, but it does not assign a figure number, reference target, or temporary ID until the ID is persisted in the source.

Before an official editor downloads `.aimd`, packages `.aira`, or performs another explicit formal-save action, it normalizes all closed `fig` blocks. Missing IDs are generated and written back to the editor source before output is created. Existing non-empty IDs are never rewritten automatically; duplicate IDs or missing `src` fields must be corrected before formal output. Renderers do not invent temporary figure IDs.

### Referencing Figures

In an AIMD document, you can reference a figure using the <code v-pre>{{ref_fig|&lt;fig_id&gt;}}</code> syntax. For example:

````aimd
As shown in {{ref_fig|fig_1}}, this is an example figure.

```fig
id: fig_1
src: files/images/example.png
title: Example Figure
legend: This is an example figure legend.
```
````

After parsing, <code v-pre>{{ref_fig|fig_1}}</code> will be rendered as a numbered figure reference marker (for example, “Figure 1”) with target metadata. Host applications can use that metadata to scroll to the figure without rewriting their own route state.

## Syntax Design Rationale

In academic writing, figures typically include both a title and a legend. Using the `fig` code block allows authors to insert images into Markdown documents while attaching the necessary metadata. This approach is analogous to figure insertion in LaTeX but better aligned with Markdown’s style and ergonomics.
