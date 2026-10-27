# AIMD Syntax Tour

This example is the canonical interactive syntax tour used by `apps/aimd-demo`. It is intentionally broad rather than domain-specific, so users can inspect common AIMD constructs in one file.

## What It Covers

- Scalar variables and structured built-in field types.
- Markdown, code, JSON, YAML, and sequence fields.
- Variable tables and inline variables inside Markdown tables.
- Browser-side client assigners, including an auto calculator and a manual list assigner.
- Figures, citations, BibTeX refs, steps, nested steps, checkpoints, timers, references, and quizzes.
- Quoted string parameter boundaries, including AIMD-looking text that stays literal inside `checked_message`.
- Markdown rendering features such as tables, blockquotes, CriticMarkup review marks, inline math, and display math.

## Usage

Open the [English tour](./protocol.aimd) or [Chinese tour](./protocol.zh-CN.aimd) in an AIMD renderer, recorder, or demo application. The Demo selects the corresponding language when loading this template. Existing editor drafts are not replaced automatically.

Both versions share stable field IDs, enum values, references, assets, and client assigner code. Labels, instructions, step titles, quiz text, and feedback are localized. The English entry keeps its existing `protocol.aimd` path for compatibility. Add concise examples to both files when a new user-visible AIMD field experience needs demo coverage. Steps illustrate optional titles; checkpoints put their instructions in the following body text. This is a syntax demonstration, not a validated experiment or clinical assessment.
