# Cross referencing in Airalogy Markdown

## Airalogy Field: Step

在Airalogy Markdown (AIMD)中，我们可能会遇到一种情况，即我们需要在文档中多次引用同一个Airalogy Step的标签，以便于Airalogy Protocol (AP)设计者能够方便的引用某个Step，并方便AP使用者能够容易地在复杂的Steps结构中找到所提示的相关步骤。为了支持这种情况，我们引入了`ref_step`模板。

语法：

```aimd
{{ref_step|<step_id>}}
```

Example:

```aimd
{{step|pseudo_step_id,1}} Prepare ...

According to {{ref_step|pseudo_step_id}}, we can see that...
```

This will be rendered as:

```md
**Step 1:** Prepare ...

According to **Step 1**, we can see that...
```

## Airalogy Field: Variable

在AIMD中，我们可能会遇到一种情况，即我们需要在文档中多次引用同一个Variable的值。为了支持这种情况，我们引入了`ref_var`模板。

语法：

```aimd
{{ref_var|<var_id>}}
```

Example:

```aimd
The value of `pseudo_var_id` is {{var|pseudo_var_id}}.

<!-- Assume that the value of `pseudo_var_id` is `123`. -->

According to the value of {{ref_var|pseudo_var_id}}, we can see that...
```

This will be rendered as:

```md
The value of `pseudo_var_id` is **123**.

According to the value of **123**, we can see that...
```
