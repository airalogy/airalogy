# Client Runtime Assigner Design Notes

This page explains the design of `assigner runtime=client`.  
If you have not read the main Assigner page yet, start with [Assigner Syntax](./assigner.md).

## Minimal Shape

For first-time readers, the shortest version to remember is:

```js
assigner(config, fn);
```

Here, `config` and `fn` are just explanatory placeholders. You do not literally need variables named `config` or `fn`. The intended meaning is:

- `assigner(...)`: register one client-runtime assigner.
- First argument `config`: declare the assigner's metadata.
- Second argument `fn`: declare the assigner's calculation logic.

Full example:

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["var_1", "var_2"],
    assigned_fields: ["var_3"],
  },
  function calculate_var_3({ var_1, var_2 }) {
    return {
      var_3: Math.round((var_1 + var_2) * 100) / 100,
    };
  }
);
```
````

## How should multiple assigners be written?

The current recommended and intended rule is:

- **one client assigner per `assigner runtime=client` block**;
- if one AIMD document needs multiple client assigners, write multiple blocks;
- do not put multiple sibling `assigner(...)` calls in the same block.

For example:

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["a", "b"],
    assigned_fields: ["x"],
  },
  function calculate_x({ a, b }) {
    return {
      x: a + b,
    };
  }
);
```

```assigner runtime=client
assigner(
  {
    mode: "manual",
    dependent_fields: ["x"],
    assigned_fields: ["y"],
  },
  function calculate_y({ x }) {
    return {
      y: x * 2,
    };
  }
);
```
````

This has a few practical benefits:

- one block maps to one assigner node, which is the easiest mental model;
- graph extraction and error reporting stay simpler;
- documentation, AI generation, and code review all stay more stable.

## Why split it into two parts?

The client assigner syntax is intentionally divided into two layers:

- **Declaration layer**: what fields the assigner depends on, what fields it writes, and how it should be triggered.
- **Calculation layer**: how the output is computed once dependencies are ready.

This split has three direct benefits:

1. Dependencies stay explicit, which makes global assigner-graph validation possible.
2. Complex logic can live inside the function body instead of being forced into tiny expressions.
3. The overall syntax still stays close to JavaScript, which helps with highlighting, AI generation, and AST tooling.

## What is `assigner(...)`?

`assigner(...)` is not a JavaScript built-in. It is a **special registration entry point** provided by the AIMD / Airalogy runtime.

You can think of it as:

- Python: `@assigner(...)`
- JavaScript: `assigner(...)`

In both cases, this is not a language feature by itself. It is a registration syntax defined by the protocol system.

## What parameters exist in `config`?

`config` is a normal JavaScript object. The core parameters currently are:

- `mode`
  The trigger mode. At the protocol-semantics level, the client runtime should support `auto`, `auto_first`, and `manual`. `manual` means the assigner does not auto-run and instead waits for an explicit frontend trigger.
- `dependent_fields`
  A string array describing the input fields of this assigner.
- `assigned_fields`
  A string array describing the output fields that this assigner is responsible for writing.

Example:

```js
{
  mode: "auto",
  dependent_fields: ["var_1", "var_2"],
  assigned_fields: ["var_3"],
}
```

This can be read as:

- when `var_1` and `var_2` are ready,
- trigger in `auto` mode,
- and compute/write `var_3`.

If it is changed to:

```js
{
  mode: "manual",
  dependent_fields: ["var_1", "var_2"],
  assigned_fields: ["var_3"],
}
```

then the meaning becomes:

- this assigner still depends on `var_1` and `var_2`;
- but it does not run automatically when dependencies change;
- instead, it runs only after an explicit UI/API trigger, such as an "Assign" or "Calculate" action.

These fields must be explicit in `config`, rather than guessed from the function body, because they are required by:

- dependency-graph validation,
- duplicate-assignment checks,
- and cross-runtime cycle detection.

## What does each part of `fn` mean?

The second argument `fn` is a normal JavaScript function, for example:

```js
function calculate_var_3({ var_1, var_2 }) {
  return {
    var_3: Math.round((var_1 + var_2) * 100) / 100,
  };
}
```

It can be read piece by piece:

- `function`
  Declares a function.
- `calculate_var_3`
  The function name. In the current design, the function name becomes the client assigner's `id`, so a separate `id` field is not required.
- `({ var_1, var_2 })`
  The function conceptually receives one object containing all `dependent_fields`. This is parameter destructuring: instead of repeatedly writing `dependent_fields.var_1`, the values are unpacked directly into local names.
- `return { ... }`
  Returns the output value object for this assignment. The returned object is directly the value object for the declared `assigned_fields`; it does not need an extra wrapper such as `assigned_fields: { ... }`.

So the function above can be read in plain language as:

- read `var_1` and `var_2`
- compute `var_3`
- return `{ var_3: ... }` as the assignment result

## Input/Output Contract

The core contract of a client assigner can be summarized as:

- input: `dependent_fields`
- output: `assigned_fields`

In other words:

- the input boundary is explicitly declared by `dependent_fields`;
- the output boundary is explicitly declared by `assigned_fields`;
- the logic in the middle can be simple or complex.

Because these boundaries stay explicit, the syntax is easier to understand for users, AI assistants, validators, and runtimes alike.

## How are the value types of `dependent_fields` / `assigned_fields` determined?

The field values seen by the client runtime are not arbitrary JavaScript object types. They are the **record-value representation of the protocol fields**.

More concretely:

- each value in `dependent_fields` comes from the current record data held by the frontend recorder;
- each value written back through `assigned_fields` must also follow that field's record-value representation;
- the shape of those values is ultimately determined by the field's own type/schema in the protocol, not invented separately by the assigner.

So a client assigner should treat both its inputs and outputs as **JSON-oriented record values**, not as Python objects or arbitrary runtime instances.

In the current client runtime, this usually means:

- scalar fields appear as JSON primitive types such as `string`, `number`, `boolean`, or `null`;
- composite fields appear as JSON structures such as `array` / `object`;
- if an entire `var_table` is used as one value, it will typically appear as a JSON-like table structure, for example `array<object>`.

This is also why the client assigner documentation consistently emphasizes that:

- it consumes record values already present in the recorder;
- it does not directly operate on Python types, Pydantic models, or backend runtime objects;
- its computation boundary is a finite, serialisable, JSON-like data structure.

In short:

- field **names** are declared by `dependent_fields` / `assigned_fields`;
- field **value types** are determined by the protocol field's own schema / record-value representation.

## Why prefer parameter destructuring?

Recommended:

```js
function calculate_var_3({ var_1, var_2 }) {
  return {
    var_3: var_1 + var_2,
  };
}
```

Less preferred:

```js
function calculate_var_3(dependent_fields) {
  return {
    var_3: dependent_fields.var_1 + dependent_fields.var_2,
  };
}
```

The second form can still work, but the first one is shorter, clearer, and closer to the intended mental model: the input is a `dependent_fields` object, and the needed fields are unpacked immediately.

## How do multiple output fields work?

If `assigned_fields` declares multiple fields, the `return` object should contain all of them in one shot. For example:

```js
assigner(
  {
    mode: "auto",
    dependent_fields: ["mass_g", "volume_ml"],
    assigned_fields: ["density_g_ml", "concentration_g_ml"],
  },
  function calculate_solution_metrics({ mass_g, volume_ml }) {
    const density = mass_g / volume_ml;
    return {
      density_g_ml: density,
      concentration_g_ml: density,
    };
  }
);
```

This means one assigner can naturally support:

- multiple input fields
- multiple output fields

as long as the returned object keys match `assigned_fields`.

## Runtime Constraints

`runtime=client` is intended for fast, deterministic, frontend-local computation, so these principles should hold:

- keep it deterministic;
- keep it side-effect free;
- do not rely on network access, environment variables, DOM APIs, file I/O, randomness, or timers;
- prefer standard JavaScript capabilities such as `Math.round(...)`.

If the computation needs external services, Python libraries, or stronger environment capabilities, keep using `assigner.py`.
