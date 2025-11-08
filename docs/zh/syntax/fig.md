# 在Airalogy Markdown中插入图

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

注意`fig`代码块符合YAML语法。如果Legend包含多行文本，可以使用YAML的多行字符串语法，例如：

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

在AIMD文档中，您可以通过`{{ref_fig|<fig_id>}}`语法来引用图像。例如：

````aimd
如{{ref_fig|fig_1}}所示，这是一个示例图。

```fig
id: fig_1
src: files/images/example.png
title: 示例图
legend: 这是一个示例图的图例说明。
```
````

解析后，`{{ref_fig|fig_1}}`将被替换为图像的编号（例如“Figure 1”），并且该编号将链接到图像所在位置。

## 语法设计说明

该语法设计的原因在于，在学术写作中，图像通常需要附带标题和图例说明。通过使用`fig`代码块，作者可以方便地在Markdown文档中插入图像，并为其添加必要的元数据。这种方法类似于LaTeX中的图像插入方式，但更适合Markdown的语法风格。
