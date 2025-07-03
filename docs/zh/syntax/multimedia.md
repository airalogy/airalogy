# 在Airalogy Protocol添加Multimedia Files

在Airalogy Protocol中，允许用户在`protocol.aimd`中引用Protocol随附的图片、PDF、视频、音频等。

这些多模数据可在储存在`/files/`目录下（储存在其他文件夹下可能读取失败），并在`protocol.aimd`中通过`/files/`路径引用。

例如，一个典型的Airalogy Protocol的目录结构可能如下：

```txt
protocol/
├── protocol.aimd
├── files/
...
```

各种多模数据都可以混杂的直接放在`/files/`目录下。当然，但为了更好的管理，建议按照类型分别存放。例如，可以将不同类型的数据分别储存在：

- 图片：`/files/images/`
- 视频：`/files/videos/`
- 音频：`/files/audios/`
- PDF：`/files/pdfs/`
- ...

在`protocol.aimd`中引用方式如下：

```aimd
图片：

![图片](files/images/xxx.png)

视频：

本地视频：
<video width="600" controls>
    <source src="files/videos/xxx.mp4" type="video/mp4">
</video>

网络视频：
<iframe
    width="560" height="315"
    src="https://www.youtube.com/embed/VIDEO_ID" 
    frameborder="0" 
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen
>
</iframe>

音频：

<audio controls>
    <source src="files/audios/xxx.mp3" type="audio/mpeg">
</audio>

PDF：

[PDF](files/pdfs/xxx.pdf) 
<!-- 因为PDF通常有多页，这里设计为链接形式。用户点击之后可以跳转到新的页面浏览或者下载后浏览。 -->
```
