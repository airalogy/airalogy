# 在Airalogy Markdown中插入图

`fig` 用于静态图片，重点是图号、图题、图例和 <code v-pre>{{ref_fig|...}}</code> 引用。即使图片来自 `.aira` 里的本地文件，也仍然推荐使用 `fig`。如果要插入视频、音频、PDF 或需要播放器交互的课件媒体，请使用 [`media`](./multimedia.md)。

## 插入图

在AIMD中，您可以通过使用`fig`代码块来插入图像。例如：

````aimd
```fig
id: fig_1  # 图在文档中的唯一ID（短ID）
src: files/images/example.png # 图像文件的路径
title: 示例图 # 可选，但推荐
legend: 这是一个示例图的图例说明。 # 可选，但推荐
```
````

上面示意的是使用本地文件`files/images/example.png`作为图像源。您也可以使用网络URL作为图像源，例如：

````aimd
```fig
id: fig_2
src: https://example.com/images/online_image.png
title: 在线图像示例
legend: 这是一个使用网络URL的图像示例。
```
````

或使用Airalogy文件ID作为图像源，例如：

````aimd
```fig
id: fig_3
src: airalogy.id.file.12345678-1234-1234-1234-1234567890ab.png
title: Airalogy文件图像示例
legend: 这是一个使用Airalogy文件ID的图像示例。
```
````

`fig` 代码块内部是键值对，兼容 YAML 写法；如果 `legend` 包含多行文本，可以使用 `|`：

````aimd
```fig
id: fig_2
title: 多行图示例   
legend: |
  这是一个包含多行文本的图例说明。
  第二行文本。
  第三行文本。
```
````

### 引用图

在AIMD文档中，您可以通过 <code v-pre>{{ref_fig|&lt;fig_id&gt;}}</code> 语法来引用图像。例如：

````aimd
如{{ref_fig|fig_1}}所示，这是一个示例图。

```fig
id: fig_1
src: files/images/example.png
title: 示例图
legend: 这是一个示例图的图例说明。
```
````

解析后，<code v-pre>{{ref_fig|fig_1}}</code> 会渲染为带编号的图引用标记（例如“图 1”），并保留目标 metadata。宿主应用可以用这些 metadata 滚动定位到对应图像，而不需要改写自身路由状态。

## 语法设计说明

该语法设计的原因在于，在学术写作中，图像通常需要附带标题和图例说明。通过使用`fig`代码块，作者可以方便地在Markdown文档中插入图像，并为其添加必要的元数据。这种方法类似于LaTeX中的图像插入方式，但更适合Markdown的语法风格。
