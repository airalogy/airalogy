# Citing in Airalogy Markdown

In AIMD, you can cite references. For example:

````aimd
Airalogy is the world’s first universal platform for research digitization, automation, and acceleration {{cite|yang2025airalogy}}.

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

In the example above, `{{cite|yang2025airalogy}}` inserts an in-text citation marker, and the reference details are provided in BibTeX within a fenced code block whose **info string must be** `refs`. AIMD will automatically process these citations and generate a references list in the final rendered document.

Within a single `cite` tag, you can cite one or multiple references separated by commas. For example:

```aimd
{{cite|ref_id_1,ref_id_2,...}}
```

## Design Notes

This syntax is inspired by LaTeX. In LaTeX, citations are typically written with `\cite{ref_id}`, and references are stored in a `.bib` file. AIMD simplifies this by letting you manage citations and references directly in the Markdown file, without external files. This improves portability and ease of use.
