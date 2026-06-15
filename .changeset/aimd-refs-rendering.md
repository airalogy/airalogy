---
"airalogy": minor
"@airalogy/aimd-core": minor
"@airalogy/aimd-renderer": minor
"@airalogy/aimd-recorder": patch
---

Add first-class AIMD `refs` BibTeX block support across Python and npm parsers, expose structured references in extracted fields, and render numbered citation markers plus generated references lists in HTML, Vue, recorder styles, and Airalogy Reader. Citation markers now display compact non-navigating markers such as `[1]` based on refs-list order, show selectable reference popovers on hover or keyboard focus, preserve the original BibTeX key in metadata, and place generated references lists at the end of the rendered AIMD document.

Add a renderer-level `resolveAssetUrl` hook for protocol-local figure assets, and wire the recorder's existing `resolveFile` prop into figure rendering so hosts can keep clean relative `fig` sources while displaying packaged or archived assets correctly.

Refine rendered figure styling so images, figure titles, and legends appear as one attached framed figure block across renderer, recorder, demo, and Reader surfaces.

Render AIMD internal reference markers with route-safe target metadata instead of bare hash hrefs, and let the demo scroll within the current AIMD container when users activate those references.
