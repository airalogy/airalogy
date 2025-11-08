# 在Airalogy Markdown中引用

在AIMD中，你可以引用文献。例如：

````aimd
Airalogy是世界上第一个全学科通用的科研数字化、自动化和加速平台{{cite|yang2025airalogy}}。

```refs
@misc{yang2025airalogy,
      title={Airalogy: AI-empowered universal data digitization for research automation}, 
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586}, 
}
```
````

在上面的例子中，`{{cite|yang2025airalogy}}`用于在文本中插入引用标记，而引用的详细信息以BibTeX格式放在代码块中的`refs`部分（该代码块的注释名必须为`refs`）。AIMD会自动处理这些引用，并在最终渲染的文档中生成参考文献列表。

在一个`cite`标签中，你可以引用一个或多个参考文献，多个引用之间用逗号分隔。例如：

```aimd
{{cite|ref_id_1,ref_id_2,...}}
```

## 语法设计说明

该语法设计参考了LaTeX中的引用方式。在LaTeX中，引用通常使用`\cite{ref_id}`命令，而参考文献则放在`.bib`文件中。AIMD的设计旨在简化这一过程，使用户能够直接在Markdown文件中管理引用和参考文献，而无需外部文件。这种设计提高了文档的可移植性和易用性。
