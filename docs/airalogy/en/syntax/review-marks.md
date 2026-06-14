# Review Mark Syntax

Airalogy Markdown supports CriticMarkup-style review marks in normal Markdown text. These marks are intended for editorial review, protocol drafting, and report annotation; they are not data fields and do not create entries in `data.var`, `data.quiz`, or other Record payload sections.

## Forms

| Purpose | Syntax | Meaning |
| --- | --- | --- |
| Addition | `{++added text++}` | Text proposed for insertion. |
| Deletion | `{--deleted text--}` | Text proposed for removal. |
| Substitution | `{~~old wording~>new wording~~}` | Replace old text with new text. |
| Comment | `{>>review note<<}` | Reviewer note or editorial comment. |
| Highlight | `{==important text==}` | Emphasis for review attention. |

Example:

```aimd
The buffer is {~~usually~>always~~} prepared fresh. {>>Confirm storage stability.<<}

Use {++fresh catalyst++} when the reaction starts, remove {--the unused heating step--}, and mark {==temperature drift==} for review.
```

## Parsing Model

Review marks are part of the Markdown layer, not the AIMD field layer. Python helpers such as `parse_aimd()` keep them as ordinary Markdown text, while frontend renderers such as `@airalogy/aimd-renderer`, recorder previews, and Airalogy Reader can render them as semantic review annotations.

`@airalogy/aimd-core` exposes `remarkCriticMarkup` for hosts that need AST-level review mark nodes. The plugin produces `criticAddition`, `criticDeletion`, `criticSubstitution`, `criticComment`, and `criticHighlight` nodes without changing AIMD field extraction.

## Literal Contexts

Review marks inside inline code and fenced code blocks remain literal source text:

````aimd
Use `{++literal++}` when documenting syntax.

```text
{--not parsed in code fences--}
```
````

## Escaping

Prefix the opening brace with a backslash when the source text should remain literal in normal Markdown:

```aimd
\{++not a review mark++}
```

## Interaction With GFM

The substitution form uses `~~`, which also appears in GitHub Flavored Markdown strikethrough syntax. Airalogy renderers protect substitution spans before GFM parsing so `{~~old~>new~~}` is treated as a review substitution rather than a strikethrough segment.
