# Parsed Nodes

`remarkAimd` turns AIMD inline templates and fenced blocks into MDAST nodes with `type: "aimd"`.

## Base Shape

```ts
interface BaseNode {
  type: "aimd"
  fieldType: AimdFieldType
  id: string
  scope: AimdScope
  raw: string
}
```

`id` is now the only identifier field on parsed AIMD nodes.

## Example

Source:

```aimd
{{var|sample_name: str}}
{{step|sample_preparation}}
```

Parsed node excerpts:

```ts
{
  type: "aimd",
  fieldType: "var",
  id: "sample_name",
  scope: "var",
  raw: "{{var|sample_name: str}}",
  definition: { id: "sample_name", type: "str" },
}

{
  type: "aimd",
  fieldType: "step",
  id: "sample_preparation",
  scope: "step",
  raw: "{{step|sample_preparation}}",
  level: 1,
  sequence: 0,
  step: "1",
}
```

## Notes

- `var`, `step`, `check`, and `ref_*` identifiers come from AIMD source ids.
- `quiz` and `fig` already use explicit `id` fields in their syntax and parsed output.
- Renderer-facing metadata also uses `data-aimd-id` only.
