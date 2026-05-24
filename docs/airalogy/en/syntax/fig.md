# Inserting Figures in Airalogy Markdown

## Insert Figures

In AIMD, you can insert images by using a `fig` code block. For example:

````aimd
```fig
id: fig_1  # The figure’s unique ID in the document (short ID)
src: files/images/example.png # Path to the image file
title: Example Figure # Optional but recommended
legend: This is an example figure legend. # Optional but recommended
```
````

The example above uses a local file `files/images/example.png` as the image source. You can also use an online URL as the source, for example:

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

Note that the `fig` code block follows YAML syntax. If the legend contains multiple lines, you can use YAML’s multi-line string syntax, for example:

````aimd
```fig
id: fig_2
title: Multi-line Figure Example   
legend: |
  This is a figure legend that spans multiple lines.
  Second line.
  Third line.
```
````

### Referencing Figures

In an AIMD document, you can reference a figure using the `{{ref_fig|<fig_id>}}` syntax. For example:

````aimd
As shown in {{ref_fig|fig_1}}, this is an example figure.

```fig
id: fig_1
src: files/images/example.png
title: Example Figure
legend: This is an example figure legend.
```
````

After parsing, `{{ref_fig|fig_1}}` will be replaced with the figure number (e.g., “Figure 1”), and that number will link to the figure’s location.

## Syntax Design Rationale

In academic writing, figures typically include both a title and a legend. Using the `fig` code block allows authors to insert images into Markdown documents while attaching the necessary metadata. This approach is analogous to figure insertion in LaTeX but better aligned with Markdown’s style and ergonomics.
