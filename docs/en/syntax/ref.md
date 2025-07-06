# Cross-Referencing in Airalogy Markdown

Airalogy Markdown (AIMD) lets you refer to the **same field** multiple times—handy when you need to point readers to a specific step or reuse a variable's value.
Two helper templates are available:

## 1 Referencing a Step

### Syntax

```aimd
{{ref_step|<step_id>}}
```

### Example

```aimd
{{step|prep_buffer,1}} Prepare the buffer...

According to {{ref_step|prep_buffer}}, we can see that...
```

**Rendered output**

> **Step 1:** Prepare the buffer...
>
> According to **Step 1**, we can see that...

## 2 Referencing a Variable

### Syntax

```aimd
{{ref_var|<var_id>}}
```

### Example

```aimd
The value of `total_cells` is {{var|total_cells}}.

<!-- Assume total_cells = 123 -->

According to the value of {{ref_var|total_cells}}, we can conclude…
```

**Rendered output**

> The value of `total_cells` is **123**.
>
> According to the value of **123**, we can conclude…
